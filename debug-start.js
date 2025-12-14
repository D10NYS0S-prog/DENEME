const { spawn } = require('child_process');
const fs = require('fs');

console.log('Starting Electron with debug logging...');
const logStream = fs.createWriteStream('./debug.log', { flags: 'a' });

const child = spawn('cmd.exe', ['/c', 'npm', 'start'], {
    cwd: __dirname,
    shell: true
});

child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

child.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    logStream.end();
});
