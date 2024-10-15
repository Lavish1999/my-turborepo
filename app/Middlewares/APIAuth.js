let { ProjectKey , Project} = require("../Models");
module.exports = async (req, res, next) => {
    var input = req.body;
    let public_key;
    let secret_key;
    if (typeof req == "object" && typeof input.public_key != 'undefined' && typeof input.secret_key != 'undefined') {
        public_key = input.public_key;
        secret_key = input.secret_key;
    }
    else if (typeof req == "object" && typeof req.query.public_key != 'undefined' && typeof req.query.secret_key != 'undefined') {
        public_key = req.query.public_key;
        secret_key = req.query.secret_key
    }
    else if (typeof req == "object" && typeof req.headers.public_key != 'undefined' && typeof req.headers.secret_key != 'undefined') {
        public_key = req.headers.public_key;
        secret_key = req.headers.secret_key
    }
    else {
        return res.status(400).send({ type: "RXERROR", message: "public_key or secret_key has invalid undefined value" });
    }

    let data = await ProjectKey.findOne({
        include:[{
            model:Project,
            as:'project'
        }],
        where: {
            public_key: public_key,
            secret_key: secret_key
        },
    });
    if (data == null) {
        return res.status(400).send({ type: "RXERROR", message: "un-Authorised public_key or secret_key", code: 401 });
    }
    req.project=data.project;
    next();
}