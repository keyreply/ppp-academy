
import { SmartTextChunker } from '../src/utils/SmartTextChunker';

function runTest(name: string, input: string, expectedChunks: string[]): boolean {
    console.log(`\n🧪 Test: ${name}`);
    const chunker = new SmartTextChunker();
    const chunks: string[] = [];

    // Simulate streaming token by token
    // To make it realistic, we can split by chars or words + punctuation
    // Let's split by regex that keeps delimiters to simulate tokens.
    // \p{Sc} captures currency symbols like $
    const tokens = input.match(/[\w']+|\p{Sc}|[.,!?;:]|\s+/gu) || [];

    for (const token of tokens) {
        const chunk = chunker.addToken(token);
        if (chunk) {
            chunks.push(chunk);
        }
    }

    const final = chunker.flush();
    if (final) chunks.push(final);

    console.log(`  Input: "${input}"`);
    console.log(`  Chunks:`, chunks);
    console.log(`  Expected:`, expectedChunks);

    // Normalize for comparison (trim)
    const normChunks = chunks.map(c => c.trim()).filter(c => c);
    const normExpected = expectedChunks.map(c => c.trim()).filter(c => c);

    const pass = JSON.stringify(normChunks) === JSON.stringify(normExpected);
    console.log(`  Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);

    return pass;
}

function runTests() {
    let passed = 0;
    let total = 0;

    total++;
    if (runTest(
        "Basic Sentence Splitting",
        "Hello there. How are you?",
        ["Hello there.", "How are you?"]
    )) passed++;

    total++;
    if (runTest(
        "Abbreviation Handling (Dr.)",
        "You will be seeing Dr. Lim on Tuesday.",
        ["You will be seeing Dr. Lim on Tuesday."]
    )) passed++;

    total++;
    if (runTest(
        "Abbreviation Handling (Mr./Mrs.)",
        "Mr. Smith and Mrs. Jones are here.",
        ["Mr. Smith and Mrs. Jones are here."]
    )) passed++;

    total++;
    // Test Clause Splitting (requiring min words)
    // "This is a very long sentence" = 6 words
    // "which involves multiple clauses" = 4 words
    // "so we should split it" = 5 words
    // Total > 10 words before comma?
    // "This is a very long sentence, which involves multiple clauses" -> 11 words -> split at comma?
    // Wait, chunker splits at clause IF buffer > minChunkWords (default 10).

    // High word count test
    const longSentence = "This is a sufficiently long sentence to trigger the clause splitting mechanism, which is designed to reduce latency for long responses.";
    if (runTest(
        "Long Sentence Clause Splitting",
        longSentence,
        [
            "This is a sufficiently long sentence to trigger the clause splitting mechanism,", // 12 words
            "which is designed to reduce latency for long responses."
        ]
    )) passed++;

    total++;
    // Low word count test (should NOT split at comma)
    if (runTest(
        "Short Clause No Split",
        "Short, but sweet.",
        ["Short, but sweet."]
    )) passed++;

    total++;
    if (runTest(
        "Currency Handling",
        "The price is $10.50. Is that okay?",
        ["The price is $10.50.", "Is that okay?"]
    )) passed++;

    total++;
    if (runTest(
        "Decimal Handling",
        "The value is 3.14 approx.",
        ["The value is 3.14 approx."]
    )) passed++;

    total++;
    if (runTest(
        "Time Handling",
        "Meeting is at 5:30 PM.",
        ["Meeting is at 5:30 PM."]
    )) passed++;

    // Test space after punctuation in numbers (bad formatting but possible)
    // "It is 5: 30" -> should NOT split if word count is low
    total++;
    if (runTest(
        "Broken Time Handling (Low Word Count)",
        "It is 5: 30 PM.",
        ["It is 5: 30 PM."]
        // "It comes to 5:" is 3 words, < 10, so no split at colon
    )) passed++;

    console.log(`\n\nFinal Results: ${passed}/${total} passed`);
}

runTests();
