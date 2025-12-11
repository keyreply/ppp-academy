import { MINIMAX_CONFIG } from '../src/utils/config';
import { StreamPacer } from '../src/utils/StreamPacer';

// Load .env manually since this script runs outside of Wrangler
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line: string) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Strip surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
} catch (e) {
    console.log('Could not load .env file directly, relying on process execution environment.');
}

interface TestResult {
    testName: string;
    text: string;
    success: boolean;
    requestStartTime: number;
    firstChunkTime: number | null;
    streamEndTime: number;
    totalBytes: number;
    chunkCount: number;
    audioDurationMs: number;
    wasInterrupted: boolean;
    outputFile: string | null;
    error?: string;
}

/**
 * Convert raw PCM data to WAV format
 * PCM: 16-bit signed, mono, 16kHz
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 16000, channels: number = 1, bitsPerSample: number = 16): Uint8Array {
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM data
    const wavData = new Uint8Array(buffer);
    wavData.set(pcmData, headerSize);

    return wavData;
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Stream TTS with pacer and collect audio
 */
async function streamWithPacer(
    text: string,
    apiKey: string,
    options: {
        usePacer: boolean;
        targetBufferMs?: number;
        interruptAfterMs?: number;
    } = { usePacer: true }
): Promise<{
    audioChunks: Uint8Array[];
    metrics: {
        requestStartTime: number;
        firstChunkTime: number | null;
        streamEndTime: number;
        chunkCount: number;
        totalBytes: number;
        wasInterrupted: boolean;
    };
}> {
    const audioChunks: Uint8Array[] = [];
    let firstChunkTime: number | null = null;
    let chunkCount = 0;
    let totalBytes = 0;
    let wasInterrupted = false;

    const pacer = new StreamPacer({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        targetBufferMs: options.targetBufferMs ?? 250,
    });

    const payload = {
        model: "speech-2.6-turbo",
        text,
        stream: true,
        output_format: "hex",
        voice_setting: {
            voice_id: "moss_audio_148aacec-d25f-11f0-96d2-927ba0120a3d",
            speed: 1,
            vol: 1,
            pitch: 0
        },
        pronunciation_dict: {
            tone: ["NRIC/N R I C"]
        },
        audio_setting: {
            sample_rate: 16000,
            bitrate: 128000,
            format: "pcm",
            channel: 1
        }
    };

    const requestStartTime = Date.now();

    const response = await fetch("https://api.minimax.io/v1/t2a_v2", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body reader');

    const decoder = new TextDecoder();
    let buffer = '';

    // Setup interrupt timer if requested
    let shouldStop = false;
    let interruptTimer: ReturnType<typeof setTimeout> | null = null;
    if (options.interruptAfterMs) {
        interruptTimer = setTimeout(() => {
            console.log(`  ⏱️  Interrupt triggered after ${options.interruptAfterMs}ms`);
            shouldStop = true;
        }, options.interruptAfterMs);
    }

    // Reset pacer at stream start
    if (options.usePacer) {
        pacer.reset();
    }

    try {
        while (true) {
            if (shouldStop) {
                wasInterrupted = true;
                reader.cancel();
                break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (shouldStop) {
                    wasInterrupted = true;
                    break;
                }

                if (line.trim().startsWith('data:')) {
                    try {
                        const jsonStr = line.replace('data:', '').trim();
                        if (jsonStr === '[DONE]') continue;

                        const data = JSON.parse(jsonStr);
                        const hexAudio = data.data?.audio;

                        if (hexAudio) {
                            const byteArray = new Uint8Array(
                                hexAudio.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
                            );

                            // Record first chunk time
                            if (firstChunkTime === null) {
                                firstChunkTime = Date.now();
                            }

                            chunkCount++;
                            totalBytes += byteArray.length;

                            // Apply pacing if enabled
                            if (options.usePacer) {
                                await pacer.pace(byteArray.byteLength);

                                // Check interrupt after pacing
                                if (shouldStop) {
                                    wasInterrupted = true;
                                    break;
                                }
                            }

                            audioChunks.push(byteArray);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }

            if (wasInterrupted) break;
        }
    } finally {
        if (interruptTimer) {
            clearTimeout(interruptTimer);
        }
    }

    const streamEndTime = Date.now();

    // Log pacer stats
    if (options.usePacer) {
        const stats = pacer.getStats();
        console.log(`  📊 Pacer stats: ${stats.bytesSent} bytes, ${stats.audioDurationMs.toFixed(0)}ms audio, ${stats.elapsedMs}ms elapsed, lead=${stats.leadMs.toFixed(0)}ms`);
    }

    return {
        audioChunks,
        metrics: {
            requestStartTime,
            firstChunkTime,
            streamEndTime,
            chunkCount,
            totalBytes,
            wasInterrupted,
        },
    };
}

/**
 * Run a single test case
 */
async function runTest(
    testName: string,
    text: string,
    apiKey: string,
    options: {
        usePacer: boolean;
        targetBufferMs?: number;
        interruptAfterMs?: number;
    }
): Promise<TestResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Test: ${testName}`);
    console.log(`   Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    console.log(`   Pacer: ${options.usePacer ? `enabled (buffer=${options.targetBufferMs ?? 250}ms)` : 'disabled'}`);
    if (options.interruptAfterMs) {
        console.log(`   Interrupt: after ${options.interruptAfterMs}ms`);
    }
    console.log('='.repeat(60));

    try {
        const { audioChunks, metrics } = await streamWithPacer(text, apiKey, options);

        // Calculate metrics
        const ttfb = metrics.firstChunkTime ? metrics.firstChunkTime - metrics.requestStartTime : null;
        const totalStreamTime = metrics.streamEndTime - metrics.requestStartTime;
        const audioDurationMs = (metrics.totalBytes / 32000) * 1000; // 16kHz * 2 bytes = 32000 bytes/sec

        console.log(`\n📈 Results:`);
        console.log(`   ├─ TTFB (time to first byte): ${ttfb !== null ? `${ttfb}ms` : 'N/A'}`);
        console.log(`   ├─ Total stream time: ${totalStreamTime}ms`);
        console.log(`   ├─ Audio duration: ${audioDurationMs.toFixed(0)}ms`);
        console.log(`   ├─ Chunks received: ${metrics.chunkCount}`);
        console.log(`   ├─ Total bytes: ${metrics.totalBytes}`);
        console.log(`   ├─ Interrupted: ${metrics.wasInterrupted ? 'Yes' : 'No'}`);
        if (options.usePacer && !metrics.wasInterrupted) {
            const realTimeFactor = totalStreamTime / audioDurationMs;
            console.log(`   └─ Real-time factor: ${realTimeFactor.toFixed(2)}x (1.0 = perfect real-time)`);
        }

        // Save audio to file
        let outputFile: string | null = null;
        if (audioChunks.length > 0) {
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedPcm = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
                combinedPcm.set(chunk, offset);
                offset += chunk.length;
            }

            const wavData = pcmToWav(combinedPcm);
            const safeName = testName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            outputFile = path.resolve(__dirname, `../output_${safeName}_${timestamp}.wav`);

            fs.writeFileSync(outputFile, Buffer.from(wavData));
            console.log(`\n💾 Audio saved: ${outputFile}`);
        }

        return {
            testName,
            text,
            success: true,
            requestStartTime: metrics.requestStartTime,
            firstChunkTime: metrics.firstChunkTime,
            streamEndTime: metrics.streamEndTime,
            totalBytes: metrics.totalBytes,
            chunkCount: metrics.chunkCount,
            audioDurationMs,
            wasInterrupted: metrics.wasInterrupted,
            outputFile,
        };

    } catch (error) {
        console.error(`\n❌ Test failed: ${error}`);
        return {
            testName,
            text,
            success: false,
            requestStartTime: Date.now(),
            firstChunkTime: null,
            streamEndTime: Date.now(),
            totalBytes: 0,
            chunkCount: 0,
            audioDurationMs: 0,
            wasInterrupted: false,
            outputFile: null,
            error: String(error),
        };
    }
}

async function testMinimax() {
    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;

    if (!apiKey || !groupId) {
        console.error('❌ Missing MINIMAX_API_KEY or MINIMAX_GROUP_ID in environment');
        process.exit(1);
    }

    console.log('🎙️  Minimax TTS Streaming Test with StreamPacer');
    console.log('================================================\n');
    console.log(`API URL: ${MINIMAX_CONFIG.baseUrl}${MINIMAX_CONFIG.ttsEndpoint}`);
    console.log(`API Key: ${apiKey.substring(0, 10)}... (Length: ${apiKey.length})`);

    const results: TestResult[] = [];

    // Test 1: Short text without pacer (baseline)
    results.push(await runTest(
        'Short text - No Pacer (baseline)',
        'Hello, how can I help you today?',
        apiKey,
        { usePacer: false }
    ));

    // Test 2: Short text with pacer
    results.push(await runTest(
        'Short text - With Pacer',
        'Hello, how can I help you today?',
        apiKey,
        { usePacer: true, targetBufferMs: 250 }
    ));

    // Test 3: Medium text with pacer
    results.push(await runTest(
        'Medium text - With Pacer',
        'Thank you for calling KeyReply Properties. My name is Alex, and I specialize in helping families find their perfect home. Do you have a moment to discuss your real estate needs?',
        apiKey,
        { usePacer: true, targetBufferMs: 250 }
    ));

    // Test 4: NRIC pronunciation test
    results.push(await runTest(
        'NRIC Pronunciation Test',
        'What is the last 4 characters of your NRIC? Please spell it out for me.',
        apiKey,
        { usePacer: true, targetBufferMs: 250 }
    ));

    // Test 5: Interrupt test - simulate user barge-in
    results.push(await runTest(
        'Interrupt Test (500ms)',
        'This is a longer sentence that will be interrupted midway through to simulate a user barge-in scenario where the caller starts speaking.',
        apiKey,
        { usePacer: true, targetBufferMs: 250, interruptAfterMs: 500 }
    ));

    // Test 6: Different buffer sizes
    results.push(await runTest(
        'Low buffer (100ms)',
        'Testing with a smaller buffer for lower latency.',
        apiKey,
        { usePacer: true, targetBufferMs: 100 }
    ));

    results.push(await runTest(
        'High buffer (500ms)',
        'Testing with a larger buffer for more stability.',
        apiKey,
        { usePacer: true, targetBufferMs: 500 }
    ));

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('\n| Test Name | TTFB | Stream Time | Audio Duration | Status |');
    console.log('|-----------|------|-------------|----------------|--------|');

    for (const r of results) {
        const ttfb = r.firstChunkTime ? `${r.firstChunkTime - r.requestStartTime}ms` : 'N/A';
        const streamTime = `${r.streamEndTime - r.requestStartTime}ms`;
        const audioDur = `${r.audioDurationMs.toFixed(0)}ms`;
        const status = r.success ? (r.wasInterrupted ? '⚠️ Interrupted' : '✅ Pass') : '❌ Fail';

        console.log(`| ${r.testName.substring(0, 30).padEnd(30)} | ${ttfb.padEnd(6)} | ${streamTime.padEnd(13)} | ${audioDur.padEnd(14)} | ${status} |`);
    }

    const passCount = results.filter(r => r.success).length;
    console.log(`\n✅ ${passCount}/${results.length} tests passed`);

    // List output files
    const outputFiles = results.filter(r => r.outputFile).map(r => r.outputFile);
    if (outputFiles.length > 0) {
        console.log('\n📁 Output files:');
        for (const file of outputFiles) {
            console.log(`   ${file}`);
        }
    }
}

testMinimax();
