// require('dotenv').config();
// BaseDir
global.baseDir = () => {
  let dir = __dirname;
  return dir.substr(0, dir.length - 20);
};

//baseFile
global.baseFile = filename => {
  return baseDir() + filename;
};

// dump and die
global.dd = (...data) => {
  logInfo(...data);
  process.exit(0);
};

// env config
global.env = (key, value = "") => {
  const fs = require("fs");

  let rawdata = fs.readFileSync(baseDir() + "env.json");
  let env = JSON.parse(rawdata);

  return typeof env[key] != "undefined" ? env[key] : value;
  // return process.env[key]
};

// config
global.config = value => {
  let varArray = value.split(".");
  try {
    var config = require(baseFile("./config/" + varArray[0]));
  } catch (e) {
    return "";
  }
  return config;
};

// controller
global.controller = path => {
  let Controller = require(baseFile("app/Controllers/" + path));

  let instance = new Controller();

  return instance;
};

// middleware
global.middleware = path => {
  let Middleware = require(baseFile("app/Middlewares/"+path));
  return Middleware;
};

// model
global.model = path => {
  let Model = require(baseFile("app/Models/" + path));
  return Model;
};
// model
global.mongodbModel = path => {
  let Model = require(baseFile("app/Models/MongoDB/" + path)).models;
  return Model;
};

// check for development
global.isDev = () => {
  return env("DEV") ? env("DEV") : false;
};

global.logInfo = (...args)=>{
  console.log("INFO",...args);
}
global.logError = (...args)=>{
  console.log("ERROR",...args);
}