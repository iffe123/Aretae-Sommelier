let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    const key = process.argv[2];
    const v = j.tool_input ? j.tool_input[key] : '';
    process.stdout.write(v == null ? '' : String(v));
  } catch {
    // swallow — empty stdout means "no value", caller decides
  }
});
