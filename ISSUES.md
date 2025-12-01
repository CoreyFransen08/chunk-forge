- Chunk metadata enrichment should be disabled if there are unsaved changes on the editor.tsx page.  Otherwise the chunks could have been resized or other properties changed and the chunks that will be processed will not be the correct ones .  

- When chunking large documents the chunker will fail due to payload size

- Need to add back in chunk splitting feature (should allow for splitting chunks (parent/children), but copying metadata from parent chunk)