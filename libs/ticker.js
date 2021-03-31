// TODO[epic=TICKER CLASS,seq=1] create new class

const EventEmitter = require("events");

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
    this.ticker.push(...raw_ticker);

    // SECTION analysis function
    
    // ANCHOR morethan 1 million
    

    // !SECTION
  }
}

const main = async () => {
  let raw_ticker = [
    { symbol: "BANPU", side: "S", volume: 100, price: 10 },
    { symbol: "BANPU", side: "S", volume: 100, price: 10 },
  ];

  const ticker = new Ticker();
  ticker.push(raw_ticker);

  console.log(ticker.ticker);
};

if (require.main === module) {
  main();
}

module.exports = {
  Ticker: Ticker,
};
