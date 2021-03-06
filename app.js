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
const { ESTALE } = require("constants");

// Credential
const env = dotenv.config().parsed;
const BROKER = env.BROKER;
const USER_NAME = env.USER_NAME;
const PASSWORD = env.PASSWORD;

// Init standard lib
const event = new events.EventEmitter();

// Init local lib
const line = new Line("3b0L3pLfrq9tdS0Oq2e9w9cTXNBfaYEtJjJZbm953k0");
const line_1 = new Line("0JIVvMrPy24BFIN9IhbHNBVZ5mOhfaJzTg8qar9iNgm");
const portfolio = new Portfolio(100000, 2);
// TODOS if have old data then import
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

const calculateTicker = async (streaming, raw_ticker, isWorking, n) => {
  isWorking[n] = true;

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
  // volume_day_total -> volume_day_total
  let volume_day_total = parseInt(
    detail[1][0][1].replace(new RegExp(",", "g"), "")
  );

  raw_ticker["volume_day_total"] = volume_day_total;

  // calculate 5d avg volume
  // volume_5d_avg - > volume_5d_avg
  let volume_5d_avg = parseInt(
    by_date
      .slice(0, 5)
      .reduce(
        (sum, v, _, { length }) =>
          sum + parseInt(v[5].replace(new RegExp(",", "g"), "")) / length,
        0
      )
  );

  raw_ticker["volume_5d_avg"] = volume_5d_avg;

  // volume symbol buy & percent
  let volume_symbol_buy = null;
  try {
    volume_symbol_buy = parseInt(
      symbol_percent_buy_sell[0][0].replace(new RegExp(",", "g"), "")
    );
  } catch (error) {
    console.log("Error : ", error.message);
  }
  raw_ticker["volume_symbol_buy"] = volume_symbol_buy;

  // volume symbol sell
  let volume_symbol_sell = null;
  try {
    volume_symbol_sell = parseInt(
      symbol_percent_buy_sell[0][1].replace(new RegExp(",", "g"), "")
    );
  } catch (error) {
    console.log("Error : ", error.message);
  }
  raw_ticker["volume_symbol_sell"] = volume_symbol_sell;

  // percent symbol buy
  let percent_symbol_buy = null;
  try {
    percent_symbol_buy = parseInt(symbol_percent_buy_sell[1][0].match(/\d+/g));
  } catch (error) {
    console.log("Error : ", error.message);
  }
  raw_ticker["percent_symbol_buy"] = percent_symbol_buy;

  // percent symbol sell
  let percent_symbol_sell = null;
  try {
    percent_symbol_sell = parseInt(symbol_percent_buy_sell[1][2].match(/\d+/g));
  } catch (error) {
    console.log("Error : ", error.message);
  }
  raw_ticker["percent_symbol_sell"] = percent_symbol_sell;

  console.log(raw_ticker);
  ticker.push(raw_ticker);
  await eventLoopQueue();

  isWorking[n] = false;
};

let isWorking = [];
let firstRun = true;
const callCalculateTicker = async (streaming) => {
  // both must not working this
  let n = streaming.length;
  // console.log("n : ", n);
  if (firstRun) {
    firstRun = !firstRun;
    // console.log("First run");
    isWorking = Array(n).fill(false);
  }

  // console.log(isWorking.every((working) => !working));

  // ????????????????????????????????????????????????????????? ?????????????????????????????????????????????
  // every worker mush not working
  // if (!isWorking[0] && !isWorking[1]) {
  if (isWorking.every((working) => !working)) {
    // calculateTicker(streaming);
    while (!helper.isEmpty(TICKERS)) {
      // some worker must not working
      // if (!isWorking[0] || !isWorking[1]) {
      if (isWorking.some((working) => !working)) {
        // console.log(!isWorking[0] || !isWorking[1]);
        // console.log(isWorking.some((working) => !working));
        // let raw_ticker = TICKERS.shift();
        // if (!isWorking[0])
        //   calculateTicker(streaming[0], raw_ticker, isWorking, 0);
        // else if (!isWorking[1])
        // calculateTicker(streaming[1], raw_ticker, isWorking, 1);

        for (let i = 0; i < n; i++) {
          if (!isWorking[i])
            calculateTicker(streaming[i], TICKERS.shift(), isWorking, i);
          else continue;
        }
      }

      await eventLoopQueue();
    }
  }
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
  streaming.push(await streaming[0].newPage()); // [1] for checking simulate portfolio
  streaming.push(await streaming[0].newPage()); // [2] for getQoute calculate percent of volume
  // streaming.push(await streaming[0].newPage()); // [3] for getQoute calculate percent of volume

  /*
  +------------------------------------------------------+
  | SECTION TICKER regiter listener befor moniter ticker |
  +------------------------------------------------------+
  */

  // sendline
  ticker.on("costMoreThan", async (ticker) => {
    console.log(`Send line :[${new Date().toLocaleString()}]`);
    // console.log(ticker);
    line.formatNsendMessage(ticker);
  });

  // simulate buy /sell
  ticker.on("costMoreThan", async (ticker) => {
    console.log(`Ticker on sendline :[${new Date().toLocaleString()}]`);
    let symbols_form_portfolio = portfolio.getPortfolio().map((v) => v.Symbol);
    if (ticker.side == "B" && !symbols_form_portfolio.includes(ticker.symbol)) {
      // buy on offer
      console.log("BUY : ", ticker.symbol, " ", ticker.price);
      portfolio.buy(ticker.symbol, 100, ticker.price);
    }
    if (ticker.side == "S" && symbols_form_portfolio.includes(ticker.symbol)) {
      // sell on bid
      console.log("SELL : ", ticker.symbol, " ", ticker.price);
      portfolio.sell(ticker.symbol, 100, ticker.price);
    }
  });

  ticker.on("volBuyGTvol5dAvg", async (t) => {
    console.log(`Send A :[${new Date().toLocaleString()}]`);
    // prettier-ignore
    let s = 
`${t.symbol} ???????????? ${t.price} ????????? ?????????????????? ${t.cost.toLocaleString()} ?????????
volume buy : ${t.volume_symbol_buy.toLocaleString()} volume 5d avg : ${t.volume_5d_avg.toLocaleString()}
????????????????????? ${t.percent_volume_buy_per_5d_avg} %
???????????? ${t.percent_symbol_buy} % ????????? ${t.percent_symbol_sell} %`;
    line_1.sendMessage(s);
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
   * 2. cost > 500K
   */
  // threshold before sending to calculate ticker
  let price_threshold = 6;
  let cost_threshold = 100000;
  event.on("tickers", (raw_tickers) => {
    // console.log(`Event on tickers : [${new Date().toLocaleString()}]`);

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
    // console.log(raw_tickers);
    // console.log(raw_tickers);
    console.log("isEmpty : ", !helper.isEmpty(raw_tickers));
    if (!helper.isEmpty(raw_tickers)) {
      raw_tickers.forEach((v) => {
        // dont push undefined value
        // console.log("-");
        // console.log(v);
        TICKERS.push(v);
      });
      // call calculate ticker
      callCalculateTicker(streaming.slice(2));
    }
  });

  // !SECTION

  /*
  +---------------------------------+
  | SECTION PORTFOLIO register event |
  +---------------------------------+
  */

  portfolio.on("hitStopLoss", (symbol, price) => {
    console.log(symbol, " hit stoploss as ", price);
    console.log("SELL : ", symbol, " ", price);
    portfolio.sell(symbol, 100, price);
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
    monitorPorfolioMarketPrice(streaming[1], portfolio).then(() => {
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
    cost_threshold = parseFloat(req.query.cost || cost_threshold);
    price_threshold = parseFloat(req.query.price || price_threshold);
    console.log("cost : ", cost_threshold);
    console.log("price : ", price_threshold);
    res.json({
      price: price_threshold,
      cost: cost_threshold,
    });
  });

  // get threshold price & cost
  app.get("/get-threshold", (req, res) => {
    res.json({
      price: price_threshold,
      cost: cost_threshold,
    });
  });

  // export portfolio data
  app.get("/portfolio-export", (req, res) => {
    portfolio.exportData("./data/portfolio_A.json");
    res.send("ok");
  });

  app.get("/portfolio-import", (req, res) => {
    portfolio.importData("./data/portfolio_A.json");
    res.send("ok");
  });

  app.get("/set-cost-condition", (req, res) => {
    const morethan = parseFloat(req.query.cost || morethan);
    let option = { cost: morethan };
    ticker.emit("setCostMoreThan", option);
  });

  // !SECTION /SEVER
}

async function expirement() {
  let argv = process.argv.slice(2);
  const headless = true && argv[0] == "false" ? false : true;
  const browser = await puppeteer.launch({
    headless: headless,
    defaultViewport: null,
  });
  let streaming = [];
  streaming.push(await new Streaming(browser, BROKER, USER_NAME, PASSWORD)); // [0] for monitor ticker
  // streaming.push(await streaming[0].newPage());
  // streaming.push(await streaming[0].newPage());

  const {
    price,
    bid_offer,
    detail,
    by_date,
    symbol_percent_buy_sell,
    sector_percent_buy_sell,
    market_percent_buy_sell,
  } = await streaming[0].getQuote("BANPU");

  console.log(symbol_percent_buy_sell);
  tickers = [
    {
      symbol: "AOT",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "BANPU",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "INET",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "GUNKUL",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "IRPC",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "AOT",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "BANPU",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "INET",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "GUNKUL",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
    {
      symbol: "IRPC",
      side: "S",
      volume: 100,
      price: 10,
      cost: 20000000,
    },
  ];
  TICKERS.push(...tickers);

  // // LOOP OVER GLOBAL TICKER
  // callCalculateTicker(streaming.slice(0, 1));

  app.get("/ticker", (req, res) => {
    TICKERS.push(...tickers);
    callCalculateTicker(streaming.slice(0, 1));
    // console.log(isFinish);
    // res.json({
    //   worker_1: isFinish[0],
    //   worker_2: isFinish[1],
    // });
    res.send("OK");
  });
  app.get("/get-ticker", (req, res) => {
    res.json(TICKERS);
  });
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
  main();
  // expirement();
  app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
  });
}
