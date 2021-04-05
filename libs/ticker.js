// Standard Library
const EventEmitter = require("events");
// Local Library
const { helper } = require("./helper");

class Ticker extends EventEmitter {
  constructor() {
    super();
    this.ticker = [];
    this.strategy = new Strategy(this);
    // when ticker come.then call all strategy and emit with that name
    this.on("ticker", (ticker) => {
      this.strategy.All().forEach((name) => {
        if (this.strategy[name](ticker)) this.emit(name, ticker);
      });
    });
  }

  //   push new raw ticker

  push(raw_ticker) {
    // store in array ticker
    // TODOS ticker to mongo db
    // this.ticker.push(raw_ticker);

    // anounce that ticker is comiing
    this.emit("ticker", raw_ticker);
  }
}

class Strategy {
  constructor(ticker) {
    this.ticker = ticker;
  }
  // get all strategy name
  All() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(
      (v) => v !== "constructor" && v !== "All"
    );
  }
  // ticker template
  //  t =
  //   {
  //    symbol: 'SVI',
  //    side: '',
  //    volume: 1889300,
  //    price: 5,
  //    time_stamp: 2021-04-03T13:27:51.567Z
  //    cost: 9446500,
  //    total_day_volume: 15586000,
  //    percent_day_volume: 12,
  //    avg_5d_volume: 17340847,
  //    percent_5d_avg_volume: 90,
  //    percent_symbol_buy: 33,
  //    percent_symbol_sell: 50,
  // }

  costMoreThan1m(t) {
    // TODO change parameters in this
    if (t.cost > 1000000) return true;
    return false;
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
    { symbol: "BANPU", side: "S", volume: 100, price: 10, cost: 20000 },
  ];

  raw_ticker.forEach((v) => {
    ticker.push(v);
  });
};

if (require.main === module) {
  main();
}

module.exports = {
  Ticker: Ticker,
};
