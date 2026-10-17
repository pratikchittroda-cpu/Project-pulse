import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ProjectPulse</title>
  </head>
  <body>
    <main>
      <h1>ProjectPulse web workspace</h1>
      <p>The React application shell is introduced by T005.</p>
    </main>
  </body>
</html>`;

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

server.listen(port, () => {
  console.log(
    `ProjectPulse web workspace listening on http://localhost:${port}`,
  );
});
