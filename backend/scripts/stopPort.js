import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const port = Number.parseInt(process.argv[2] || process.env.PORT || '5000', 10);

if (!Number.isInteger(port) || port <= 0) {
  console.error('Please provide a valid port number.');
  process.exit(1);
}

function parseWindowsNetstat(stdout, targetPort) {
  const portPattern = new RegExp(`[:.]${targetPort}$`);

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 5)
    .filter((parts) => parts[0].toUpperCase() === 'TCP')
    .filter((parts) => parts[3].toUpperCase() === 'LISTENING')
    .filter((parts) => portPattern.test(parts[1]))
    .map((parts) => Number.parseInt(parts[4], 10))
    .filter((pid, index, values) => Number.isInteger(pid) && values.indexOf(pid) === index);
}

async function findWindowsProcessIds(targetPort) {
  const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp']);
  return parseWindowsNetstat(stdout, targetPort);
}

async function stopWindowsProcess(pid) {
  await execFileAsync('taskkill.exe', ['/PID', String(pid), '/F']);
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('dev:stop-port currently supports Windows only.');
    return;
  }

  const processIds = await findWindowsProcessIds(port);

  if (processIds.length === 0) {
    console.log(`No process is listening on port ${port}.`);
    return;
  }

  for (const pid of processIds) {
    await stopWindowsProcess(pid);
    console.log(`Stopped process ${pid} on port ${port}.`);
  }
}

export { parseWindowsNetstat };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
