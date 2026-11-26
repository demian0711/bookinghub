import { createApplication } from './application';
import { readEnvironment } from './environment';
async function main() {
  const { port } = readEnvironment();
  const app = await createApplication();
  await app.listen(port);
}
void main();
