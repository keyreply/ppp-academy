/**
 * SmartTextChunker
 *
 * Intelligently chunks streaming text for low-latency TTS.
 * Splits on:
 * 1. Sentence boundaries (., !, ?) - always split, unless abbreviation
 * 2. Clause boundaries (,, ;, :) - split only if chunk is long enough
 *
 * Handles common abbreviations (Dr., Mr., etc.) to avoid unnatural splits.
 */
export class SmartTextChunker {
    private buffer: string = '';
    private minChunkWords: number;

    // Common abbreviations that end in a dot but aren't sentence ends
    private readonly ABBREVIATIONS = new Set([
        // English (General/AU/SG/SEA)
        'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'rd', 'ave', 'blvd',
        'inc', 'ltd', 'co', 'corp', 'vs', 'est', 'dept', 'apt', 'no',
        // Portuguese (Brazil)
        'sr', 'sra', 'srs', 'sras', 'dr', 'dra', 'drs', 'dras', 'prof', 'profa',
        'eng', 'sto', 'sta', 'dom', 'dona', 'av', 'pç',
        // SG / SEA / AU
        'blk', 'jln', 'lor', 'bt', 'kg', 'upp', 'st', 'pte', 'ltd', 'pl'
    ]);

    constructor(minChunkWords: number = 10) {
        this.minChunkWords = minChunkWords;
    }

    /**
     * Add a token to the buffer and return a chunk if a boundary is reached.
     */
    addToken(token: string): string | null {
        this.buffer += token;

        // Check for sentence completion (strong boundary)
        // Looking for [.!?] followed by whitespace or quote, but not preceded by known abbreviation
        const sentenceMatch = this.buffer.match(/([.!?]['"]?)(\s+)$/);

        if (sentenceMatch) {
            // Check if it's an abbreviation
            if (!this.isAbbreviation(this.buffer)) {
                return this.flush();
            }
        }

        // Check for clause completion (weak boundary)
        // Looking for [,;:] followed by whitespace
        const clauseMatch = this.buffer.match(/([,;:])(\s+)$/);

        if (clauseMatch) {
            // Only split on clauses if we have enough words to make it worth sending
            const wordCount = this.buffer.trim().split(/\s+/).length;
            if (wordCount >= this.minChunkWords) {
                return this.flush();
            }
        }

        return null;
    }

    /**
     * Return any remaining text in the buffer.
     */
    flush(): string | null {
        const trimmed = this.buffer.trim();
        if (trimmed.length === 0) {
            return null;
        }

        // Clear buffer but keep the trailing whitespace for the next chunk if it exists?
        // Actually for TTS we usually want self-contained chunks.
        // However, if we split "Hello, how are you", we want "Hello," and "how are you".
        // The whitespace might be important for spacing but usually TTS engine handles it.
        // Let's reset fully.

        const chunk = this.buffer;
        this.buffer = '';
        return chunk;
    }

    /**
     * Check if the current buffer ends with a known abbreviation
     */
    private isAbbreviation(text: string): boolean {
        const trimmed = text.trim();
        // Get the word ending with the dot
        const match = trimmed.match(/(?:^|\s)([a-zA-Z]{2,})\.$/);
        if (!match) return false;

        const word = match[1].toLowerCase();
        return this.ABBREVIATIONS.has(word);
    }
}
