// index.js
require("./bin/kernel");
let serverless = require("serverless-http");
let express = require("express");
let path = require("path");
let logger = require("morgan");
let cookieParser = require("cookie-parser");
let apiRoutes = require("./routes/v1/api");
let LLMSparkRoutes = require("./routes/llm-spark");
let { notifyOnDiscord } = require("./helper/helper");
// Import the library:
let cors = require("cors");
let app = express();
// view engine setup
app.set("views", path.join(__dirname, "resources/views"));
app.set("view engine", "ejs"); // either pug,twig etc
// Increase the limit according to your needs

app.use(logger("dev"));

app.use(express.json({
  limit: '10mb',
  // specifically for shopify
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(express.urlencoded({limit: '10mb',  extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// Then use it before your routes are set up:


app.use(cors());
app.use("/llm-spark/", LLMSparkRoutes);
app.use("/api/v1/", apiRoutes);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next({
    status: 404,
    message: "Not Found"
  });
});

// error handler
app.use((err, req, res, next) => {
  if (err.status === 404) {
    return res.status(400).render("errors/404");
  }

  if (err.status === 500) {
    return res.status(500).render("errors/500");
  }
  next();
});


process.on('unhandledRejection', async(reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);

  let str = `Exception: **#${Date.now()}** \n\n`;
  logInfo(str)
  if(typeof reason.message=="string"){
    str = str+`\n Uncaught Exception: ${reason.message}`;
  }else if(typeof reason.message=="object"){
    str = str+`\n Uncaught Exception: ${JSON.stringify(reason.message)}`;
  }
  
  let messages=reason.stack.split('\n');
  for(let i=1;i<messages.length;i++){
    if(messages[i]==''){
      break;
    }
    str=str+'\n'+messages[i];
  }
  await notifyOnDiscord(str.slice(0,1980), "bug")
});

module.exports = app;
module.exports.handler = serverless(app);




