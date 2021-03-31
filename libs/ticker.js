// Standard Library
const EventEmitter = require("events");
// Local Library
const { helper } = require("./helper");

class Ticker extends EventEmitter {
  constructor() {
    super();
    this.ticker = [];
  }

  //   push new raw ticker

  push(raw_ticker) {
    //   add timestamp
    raw_ticker = raw_ticker.map((v) => ({
      ...v,
      timeStamp: new Date(),
    }));

    // store in array ticker
    this.ticker.push(...raw_ticker);

    // SECTION analysis function

    // ANCHOR morethan 1 million
    let ticker_morethan_1m = raw_ticker.filter((v) => v.cost > 1000000);
    if (!helper.isEmpty(ticker_morethan_1m))
      this.emit("costMoreThan1m", ticker_morethan_1m);

    // !SECTION
  }
}

const main = async () => {
  const ticker = new Ticker();

  ticker.on("costMoreThan1m", (tickers) => {
    console.log(tickers);
  });

  let raw_ticker = [
    { symbol: "BANPU", side: "S", volume: 100, price: 10, cost: 10000000 },
    { symbol: "BANPU", side: "S", volume: 100, price: 10, cost: 20000000 },
  ];

  ticker.push(raw_ticker);
};

if (require.main === module) {
  main();
}

module.exports = {
  Ticker: Ticker,
};
