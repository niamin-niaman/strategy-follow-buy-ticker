// Standard Library
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const express = require("express");
const app = express();
const port = 1579;

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

// Init local lib
const line = new Line("3b0L3pLfrq9tdS0Oq2e9w9cTXNBfaYEtJjJZbm953k0");
const portfolio = new Portfolio(100000);
const ticker = new Ticker();

// ANCHOR interval capture ticker from streaming then send throught callback function
const monitorTicker = (streaming, interval, callback) => {
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
      callback(convertTickerFormat(diff), streaming);
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
    callback(convertTickerFormat(diff), streaming);
  }, interval * 2);
};

// ANCHOR receive function from monitor function and do something with occur ticker
const getTicker = async (raw_ticker) => {
  // filter out DW by symbol length morethan 7
  raw_ticker = raw_ticker.filter((v) => v.symbol.length < 8);

  // compute volume * price
  raw_ticker.forEach((v, i) => {
    raw_ticker[i].cost = v.volume * v.price;
  });

  // push ticker to ticker
  // TODOS change to push in tmp ticks array. then use while loop with eventQueue to calculate some data from await streamin.
  // instead of push raw_ticker directly without get some data
  ticker.push(raw_ticker);
};

// ANCHOR while loop check marketprice in portfolio
// SECTION
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


async function main() {
  // get cmd arg that setting headless
  let argv = process.argv.slice(2);
  const headless = true && argv[0] == "false" ? false : true;
  const browser = await puppeteer.launch({
    headless: headless,
    defaultViewport: null,
  });

  let streaming = [];
  streaming.push(await new Streaming(browser, BROKER, USER_NAME, PASSWORD)); // [0] for monitor ticker
  streaming.push(await streaming[0].newPage()); // [1] for getQoute calculate percent of volume
  streaming.push(await streaming[0].newPage()); // [2] for checking simulate portfolio

  // SECTION TICKER regiter listener befor moniter ticker

  // sendline
  ticker.on("costMoreThan1m", async (tickers) => {
    tickers = tickers.filter((v) => v.price < 5);
    // calculate percent of value
    // for await (const v of filtered_data) {
    if (!helper.isEmpty(tickers)) {
      for (let i = 0; i < tickers.length; i++) {
        const v = tickers[i];
        const { price, bid_offer, detail } = await streaming[1].getQuote(
          v.symbol
        );
        // calculate percent volume
        let total_volume = parseInt(
          detail[1][0][1].replace(new RegExp(",", "g"), "")
        );
        let percent_volume = helper.toFixedNumber(v.volume / total_volume, 3);
        tickers[i].percent_volume = percent_volume;
      }

      console.log(`Ticker on sendline :[${new Date().toLocaleString()}]`);
      console.log(tickers);
      // Prepare message  and sending
      line.formatNsendMessage(tickers);
    }
  });

  // simulate buy /sell
  // ticker.on("costMoreThan1m", async (tickers) => {
  //   // console.log("\nbuy sell");
  //   let symbols_form_portfolio = portfolio.getPortfolio().map((v) => v.Symbol);

  //   // filter out duplicate data prevent buy morethan 100 volume
  //   // https://gist.github.com/juliovedovatto/f4ac657e5d28e060c791f5ef27b13341
  //   tickers.map((v) => ({
  //     symbol: v.symbol,
  //     side: v.side,
  //     price: v.price,
  //   }));
  //   tickers = tickers
  //     .map(JSON.stringify)
  //     .reverse() // convert to JSON string the array content, then reverse it (to check from end to begining)
  //     .filter(function (item, index, arr) {
  //       return arr.indexOf(item, index + 1) === -1;
  //     }) // check if there is any occurence of the item in whole array
  //     .reverse()
  //     .map(JSON.parse);

  //   // loop over ticker for simulate sell / buy
  //   tickers.forEach((v) => {
  //     // BUY if
  //     // - has ticker buy
  //     if (v.side == "B") {
  //       // - has no in portfolio
  //       if (!symbols_form_portfolio.includes(v.symbol)) {
  //         // action buy
  //         if (portfolio.buy(v.symbol, 100, v.price)) {
  //           console.log("BUY : ", v.symbol);
  //           portfolio.updateMktPrice(v.symbol, v.price);
  //         }
  //       }
  //     }
  //     // SELL if
  //     // - has ticker sell
  //     if (v.side == "S") {
  //       // - has in portfolio
  //       // action sell
  //       if (symbols_form_portfolio.includes(v.symbol)) {
  //         console.log("SELL : ", v.symbol);
  //         portfolio.sell(v.symbol, 100, v.price);
  //       }
  //     }
  //   });
  // });

  // !SECTION

  // ANCHOR call monitor ticker function
  // call interval
  // TODOS can do with https://stackoverflow.com/a/24091927/13080067
  monitorTicker(streaming[0], 2000, getTicker);

  // SECTION SERVER
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

  // TODO request to export

  // !SECTION /SEVER
}

async function expirement() {
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
  // let t_06 = [["J","a","b","c","d"], ["K","a","b","c","d"], ["L","a","b","c","d"], ["M","a","b","c","d"], ["N","a","b","c","d"], ["O","a","b","c","d"], ["G","a","b","c","d"], ["H","a","b","c","d"], ["I","a","b","c","d"]];
  // at t_06
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // |J|K|L|M|N|O|G|H|I|  |M|N|O|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+
  // let t_07 = [["S"], ["T"], ["L"], ["M"], ["N"], ["O"], ["P"], ["Q"], ["R"]];
  // let t_07 = [["S","a","b","c","d"], ["T","a","b","c","d"], ["L","a","b","c","d"], ["M","a","b","c","d"], ["N","a","b","c","d"], ["O","a","b","c","d"], ["P","a","b","c","d"], ["Q","a","b","c","d"], ["R","a","b","c","d"]];
  // at t_07
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+
  // |S|T|L|M|N|O|P|Q|R|  |P|Q|R|S|T|
  // +-+-+-+-+-+-+-+-+-+  +-+-+-+-+-+
  // console.log(getDiff(t_01, t_02));
  // console.log(getDiff(t_02, t_03));
  // console.log(getDiff(t_03, t_04));
  // console.log(getDiff(t_04, t_05));
  // console.log(getDiff(t_05, t_06));
  // console.log(helper.getDiff(t_06, t_07));
  // console.log('---');
  // console.log(getDiff(t_02, t_01));
  // console.log(getDiff(t_03, t_02));
  // console.log(getDiff(t_04, t_03));
  // console.log(getDiff(t_05, t_04));
  // console.log(getDiff(t_06, t_05));
  // console.log(getDiff(t_07, t_06));
  // PASRE INT / FLOAT
  // s = "82,089,100";
  // console.log(s);
  // s = s.replace(new RegExp(",", "g"), "");
  // console.log(s);
  // console.log(parseInt(s));
  // console.log(parseFloat(s));
}

if (require.main === module) {
  main();
  // expirement();
  app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`);
  });
}
