const express = require("express");
const app = express();
const PORT = 1357;

let done = true;

// setTimeout(() => {
//   done = true;
// }, 10);

const eventLoopQueue = () => {
  return new Promise((resolve) =>
    setImmediate(() => {
      // console.log("event loop");
      process.stdout.write(".");
      resolve();
    })
  );
};

const run = async () => {
  while (!done) {
    // console.log("loop");
    process.stdout.write(".");
    await eventLoopQueue();
  }
};

const main = () => {
  run().then(() => console.log("Done"));
  // setInterval(() => {
  //   done = !done;
  //   run().then(() => console.log("Done"));
  // }, 10);
  app.get("/", (req, res) => {
    done = !done;
    run().then(() => console.log("Done"));
    res.send(".");
  });

  app.get("/x", (req, res) => {
    console.log("x");
    res.send("x");
  });
};

main();
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

// REF
// https://flaviocopes.com/node-setimmediate/
// https://stackoverflow.com/a/53057063/13080067
