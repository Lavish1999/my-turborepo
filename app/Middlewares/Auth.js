let { authUser , userActivityLog } = require(baseDir() +"helper/helper");

module.exports = async(req, res, next) => {
  // Under Maintaince
  //return res.status(401).send({"type":"RXERROR","message":"We are on maintenance breaks","code":401});
  let session = await authUser(req);
  if(session==null){
      return res.status(401).send({ type:"RXERROR",message:"un-Authorised Token",code:401});
  }
  req.authUser=session;
  let data = await userActivityLog(req);
  logInfo(data,"!!!!!!!!!!!!!!!!!!")
  // Middleware Logics
  next();
};
