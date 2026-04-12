import { execSync } from 'node:child_process';

const port = Number(process.env.PORT || 8004);

try {
  const output = execSync(`netstat -ano -p tcp | findstr :${port}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/\s+(\d+)\s*$/);
    if (match) {
      pids.add(match[1]);
    }
  }

  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, {
      stdio: 'ignore',
    });
  }

  if (pids.size > 0) {
    console.log(`Released port ${port} by stopping ${pids.size} process(es).`);
  }
} catch {
  // No listener found or the port could not be queried; let startup continue.
}