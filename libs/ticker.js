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
    // strategy cost morethan
    this.cost_condition = 800000;
    this.ticker.on("setCostMoreThan", (option) => {
      this.cost_condition = option.cost;
    });
  }
  // get all strategy name
  All() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(
      (v) => v !== "constructor" && v !== "All"
    );
  }
  // ticker template
  //  t =
  // {
  //   symbol: 'TAE',
  //   side: '',
  //   volume: 1033100,
  //   price: 2.68,
  //   time_stamp: 2021-04-06T07:56:39.667Z,
  //   cost: 2768708,
  //   volume_day_total: 16048500,
  //   percent_volume_ticker_per_day: 6.44,
  //   volume_5d_avg: 7859282,
  //   percent_volume_day_per_5d_avg: 204,
  //   volume_symbol_buy: 8148700,
  //   percent_volume_symbol_buy_per_5d_avg: 104,
  //   volume_symbol_sell: 6460100,
  //   percent_volume_symbol_sell_per_5d_avg: 82,
  //   percent_symbol_buy: 51,
  //   percent_symbol_sell: 40
  // }

  costMoreThan(t) {
    // TODO change parameters in this
    t.percent_volume_ticker_per_day = helper.toFixedNumber(
      (t.volume / t.volume_day_total) * 100,
      2
    );
    t.percent_volume_day_per_5d_avg = helper.toFixedNumber(
      (t.volume_day_total / t.volume_5d_avg) * 100,
      2
    );
    if (t.cost > this.cost_condition) return true;
    return false;
  }

  // TODOS dont send duplicate ticker unless price has chage
  volBuyGTvol5dAvg(t) {
    t.percent_volume_buy_per_5d_avg = helper.toFixedNumber(
      (t.volume_symbol_buy / t.volume_5d_avg) * 100,
      2
    );
    if (t.percent_volume_buy_per_5d_avg > 75) return true;
    return false;
  }
}
const main = async () => {
  const ticker = new Ticker();

  ticker.on("costMoreThan", (tickers) => {
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
