let express = require("express");
let router = express.Router();

let llmSparkApiV1Routes = require("./v1/api");
router.use("/v1", llmSparkApiV1Routes);

module.exports = router;