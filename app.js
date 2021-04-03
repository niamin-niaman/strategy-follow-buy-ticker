// Standard Library
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
const port = 1579;
const events = require("events");

// Local Library
const { Streaming } = require("../streaming-wrapper-using-puppeteer/src/index");
const { Line } = require("./libs/line-client");
const { Portfolio } = require("./libs/portfolio");
const { Ticker } = require("./libs/ticker");
const { helper } = require("./libs/helper");

// Credential
const env = dotenv.config().parsed;
const BROKER = env.BROKER;
const USER_NAME = env.USER_NAME;
const PASSWORD = env.PASSWORD;

// Init standard lib
const event = new events.EventEmitter();

// Init local lib
const line = new Line("3b0L3pLfrq9tdS0Oq2e9w9cTXNBfaYEtJjJZbm953k0");
const portfolio = new Portfolio(100000);
const ticker = new Ticker();

/*
+-------------------------------------------------------------------------------------+
| ANCHOR interval capture ticker from streaming then send throught callback function  |
+-------------------------------------------------------------------------------------+
*/
const monitorTicker = (streaming, interval) => {
  // helper function convert ticker format from array to object
  // ["BANPU","S","100","10",""] -> { symbol : "BANPU" , side : "S" , volume : 100 , price : 10}
  const convertTickerFormat = (raw_ticker) => {
    // filter out empty data
    raw_ticker = raw_ticker.filter((v) => !(!v[0].trim() || v[0].length === 0));
    // raw_ticker[0] : symbol
    // raw_ticker[1] : side
    // raw_ticker[2] : volume
    // raw_ticker[3] : price
    return raw_ticker.map((v) => ({
      symbol: v[0],
      side: v[1],
      volume: parseInt(v[2].replace(new RegExp(",", "g"), "")),
      price: parseFloat(v[3]),
      time_stamp: new Date(),
    }));
  };

  let ticker_data_A = [];
  let ticker_data_B = [];
  let diff = [];

  // team A
  setTimeout(async () => {
    setInterval(async () => {
      ticker_data_A = await streaming.getTicker();
      diff = helper.getDiff(ticker_data_B, ticker_data_A);
      // delete duplicate data
      // let stringArray = diff.map(JSON.stringify);
      // let uniqueStringArray = new Set(stringArray);
      // diff = Array.from(uniqueStringArray, JSON.parse);
      // display data
      // console.log(`[${new Date().toLocaleString()}] : A `);
      // console.log('Diff : ',diff);
      // emit event
      event.emit("tickers", convertTickerFormat(diff));
    }, interval * 2);
  }, interval);

  // team  B
  setInterval(async () => {
    ticker_data_B = await streaming.getTicker();
    diff = helper.getDiff(ticker_data_A, ticker_data_B);
    // delete duplicate data
    // let stringArray = diff.map(JSON.stringify);
    // let uniqueStringArray = new Set(stringArray);
    // diff = Array.from(uniqueStringArray, JSON.parse);
    // display data
    // console.log(`[${new Date().toLocaleString()}] : B `);
    // console.log('Diff : ',diff);
    // emit event
    event.emit("tickers", convertTickerFormat(diff));
  }, interval * 2);
};

/*
+---------------------------------------------------+
| ANCHOR while loop check marketprice in portfolio  |
| SECTION                                           |
+---------------------------------------------------+
*/
// variable for trigger while loop
let portfolio_monitor = false;

const eventLoopQueue = () => {
  return new Promise((resolve) =>
    setImmediate(() => {
      // console.log("event loop");
      // process.stdout.write(".");
      resolve();
    })
  );
};

const monitorPorfolioMarketPrice = async (streaming, portfolio) => {
  console.log("portfolio_monitor : ", portfolio_monitor);
  while (portfolio_monitor) {
    // get all symbol from port folio
    let symbols = portfolio.getPortfolio().map((v) => v.Symbol);
    // loop over symbol to check price in streaming
    for (let index = 0; index < symbols.length; index++) {
      const element = symbols[index];
      console.log(element);
      let { price } = await streaming.getQuote(element);
      try {
        portfolio.updateMktPrice(element, price);
      } catch (error) {
        console.log("Error : ", error.message);
      }
    }
    // non-blocking while loop
    await eventLoopQueue();
  }
};

// !SECTION

/*
+---------------------------+
| SECTION calculate ticker  |
+---------------------------+
*/
// declar global ticker
const TICKERS = [];

// function that while loop get globalticker
// then get data from streaming for calculate
let isFinish = true;
const calculateTicker = async (streaming) => {
  while (!helper.isEmpty(TICKERS)) {
    isFinish = false;
    let raw_ticker = TICKERS.shift();
    // console.log(raw_ticker);
    const {
      price,
      bid_offer,
      detail,
      by_date,
      symbol_percent_buy_sell,
      sector_percent_buy_sell,
      market_percent_buy_sell,
    } = await streaming.getQuote(raw_ticker.symbol);

    // calculate percent volume
    let total_day_volume = parseInt(
      detail[1][0][1].replace(new RegExp(",", "g"), "")
    );
    let percent_day_volume = helper.toFixedNumber(
      raw_ticker.volume / total_day_volume,
      2
    );

    // calculate 5d avg volume
    let avg_5d_volume = parseInt(
      by_date
        .slice(0, 5)
        .reduce(
          (sum, v, _, { length }) =>
            sum + parseInt(v[5].replace(new RegExp(",", "g"), "")) / length,
          0
        )
    );

    let percent_5d_avg_volume = helper.toFixedNumber(
      total_day_volume / avg_5d_volume,
      2
    );

    // console.log("avg_5d_volume : ", avg_5d_volume);

    raw_ticker["total_day_volume"] = total_day_volume;
    raw_ticker["percent_day_volume"] = parseInt(percent_day_volume * 100);
    raw_ticker["avg_5d_volume"] = avg_5d_volume;
    raw_ticker["percent_5d_avg_volume"] = parseInt(percent_5d_avg_volume * 100);
    raw_ticker["percent_symbol_buy"] = parseInt(
      symbol_percent_buy_sell[1][0].match(/\d+/g)
    );
    raw_ticker["percent_symbol_sell"] = parseInt(
      symbol_percent_buy_sell[1][2].match(/\d+/g)
    );
    console.log(raw_ticker);
    ticker.push(raw_ticker);
    await eventLoopQueue();
  }
  isFinish = true;
};

const callCalculateTicker = (streaming) => {
  if (isFinish) calculateTicker(streaming);
};

// !SECTION

async function main() {
  // get cmd arg that setting headless
  let argv = process.argv.slice(2);
  const headless = true && argv[0] == "false" ? false : true;
  const browser = await puppeteer.launch({
    headless: headless,
    defaultViewport: null,
  });

  /*
  +------------------------+
  | initail streaming page |
  +------------------------+ 
  */

  let streaming = [];
  streaming.push(await new Streaming(browser, BROKER, USER_NAME, PASSWORD)); // [0] for monitor ticker
  streaming.push(await streaming[0].newPage()); // [1] for getQoute calculate percent of volume
  streaming.push(await streaming[0].newPage()); // [2] for checking simulate portfolio

  /*
  +------------------------------------------------------+
  | SECTION TICKER regiter listener befor moniter ticker |
  +------------------------------------------------------+
  */

  // sendline
  ticker.on("costMoreThan1m", async (ticker) => {
    console.log(`Ticker on sendline :[${new Date().toLocaleString()}]`);
    console.log(ticker);
    line.formatNsendMessage(ticker);
  });

  // simulate buy /sell
  ticker.on("costMoreThan1m_", async (ticker) => {
    console.log(`Ticker on sendline :[${new Date().toLocaleString()}]`);
    let symbols_form_portfolio = portfolio.getPortfolio().map((v) => v.Symbol);
    if (ticker.side == "B") {
      // buy
    }
    if (ticker.side == "S") {
      // sell
    }
  });

  // !SECTION

  /*
  +---------------------------------+
  | SECTION INTERVAL register event |
  +---------------------------------+
  */

  /**
   * when ticker alert.it will filter out
   * 1. price < 5 bath
   * 2. cost > 1 million
   */
  // threshold before sending to calculate ticker
  let price_threshold = 6;
  let cost_threshold = 500000;
  event.on("tickers", (raw_tickers) => {
    // console.log(`Event on tickers : [${new Date().toLocaleString()}]`);
    // console.log(raw_tickers);

    // filter out DW by symbol length morethan 7
    raw_tickers = raw_tickers.filter((v) => v.symbol.length < 8);

    // compute volume * price
    raw_tickers.forEach((v, i) => {
      raw_tickers[i].cost = v.volume * v.price;
    });

    // price less than 5 bath
    raw_tickers = raw_tickers.filter((v) => v.price < price_threshold);
    raw_tickers = raw_tickers.filter((v) => v.cost > cost_threshold);

    // push raw_ticker to global ticker for calculate ticker
    raw_tickers.forEach((v) => {
      TICKERS.push(v);
    });

    // call calculate ticker
    callCalculateTicker(streaming[1]);
  });

  // !SECTION

  /*
  +-------------------------------------+
  | ANCHOR call monitor ticker function |
  +-------------------------------------+
  */
  // call interval
  // TODOS can do with https://stackoverflow.com/a/24091927/13080067
  monitorTicker(streaming[0], 2000);

  /*
  +----------------+
  | SECTION SERVER |
  +----------------+
  */
  // get portfolio
  app.get("/portfolio", async (req, res) => {
    try {
      res.json({
        portfolio: portfolio.getPortfolio(),
        lineAvailable: portfolio.lineAvailable,
        sum: JSON.parse(JSON.stringify(portfolio.sum)),
      });
    } catch (error) {
      console.log("Error : ", error.message);
      res.send("null");
    }
  });

  // toggle monitor portfoilo
  app.get("/toggle-monitor-portfolio", (req, res) => {
    portfolio_monitor = !portfolio_monitor;
    monitorPorfolioMarketPrice(streaming[2], portfolio).then(() => {
      // console.log("portfolio_monitor");
    });
    res.send("portfolio_monitor : " + portfolio_monitor + "");
  });

  // get all TICKERS
  app.get("/get-ticker", (req, res) => {
    res.json(TICKERS);
  });

  // set new threshold price & cost
  app.get("/set-threshold", (req, res) => {
    cost_threshold = req.query.cost || cost_threshold;
    price_threshold = req.query.price || price_threshold;
    console.log("cost : ", cost);
    console.log("price : ", price);
    res.send("ok");
  });

  // TODO request to export

  // !SECTION /SEVER
}

async function expirement() {

  // let argv = process.argv.slice(2);
  // const headless = true && argv[0] == "false" ? false : true;
  // const browser = await puppeteer.launch({
  //   headless: headless,
  //   defaultViewport: null,
  // });
  // let streaming = [];
  // streaming.push(await new Streaming(browser, BROKER, USER_NAME, PASSWORD)); // [0] for monitor ticker
  // // LOOP OVER GLOBAL TICKER
  // callCalculateTicker(streaming[0]);
  // // setInterval(() => {
  // //   TICKERS.push({
  // //     symbol: "AOT",
  // //     side: "S",
  // //     volume: 100,
  // //     price: 10,
  // //     cost: 20000000,
  // //   });
  // // }, 1500);
  // app.get("/ticker", (req, res) => {
  //   TICKERS.push({
  //     symbol: "AOT",
  //     side: "S",
  //     volume: 100,
  //     price: 10,
  //     cost: 20000000,
  //   });
  //   callCalculateTicker(streaming[0]);
  //   // console.log(isFinish);
  //   res.send(isFinish);
  // });
  // app.get("/get-ticker", (req, res) => {
  //   res.json(TICKERS);
  // });
  // let t_01 = [[], [], [], [], [], [], [], [], []];
  // at t_01
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // | | | | | | | | | |  | | | |
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_02 = [["A"], ["B"], ["C"], [], [], [], [], [], []];
  // at t_02
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C| | | | | | |  |A|B|C|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_03 = [["A"], ["B"], ["C"], ["D"], ["E"], ["F"], [], [], []];
  // at t_03
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C|D|E|F| | | |  |D|E|F|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_04 = [["A"], ["B"], ["C"], ["D"], ["E"], ["F"], ["G"], ["H"], ["I"]];
  // at t_04
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |A|B|C|D|E|F|G|H|I|  |G|H|I|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_05 = [["J"], ["K"], ["L"], ["D"], ["E"], ["F"], ["G"], ["H"], ["I"]];
  // at t_05
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |J|K|L|D|E|F|G|H|I|  |J|K|L|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_06 = [["J"], ["K"], ["L"], ["M"], ["N"], ["O"], ["G"], ["H"], ["I"]];
  // at t_06
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |J|K|L|M|N|O|G|H|I|  |M|N|O|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_07 = [["S"], ["T"], ["L"], ["M"], ["N"], ["O"], ["P"], ["Q"], ["R"]];
  // at t_07
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+
  // |S|T|L|M|N|O|P|Q|R|  |P|Q|R|S|T|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+
}

if (require.main === module) {
  // main();
  expirement();
  app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
  });
}
