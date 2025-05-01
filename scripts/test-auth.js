const { spawn } = require('child_process');
const path = require('path');

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://yiwmthjumaoxaqtjarkb.supabase.co';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpd210aGp1bWFveGFxdGphcmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4Njg3NTEsImV4cCI6MjA1OTQ0NDc1MX0.ghwxlqL5dVh6Pb-KHVFrgg07hNFr00CZpoxCbBZpcnk';

// Run the test script using ts-node
const testProcess = spawn('npx', [
  'ts-node',
  path.join(__dirname, '../src/utils/test-auth.ts')
], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

testProcess.on('close', (code) => {
  console.log(`Test process exited with code ${code}`);
  process.exit(code);
}); 