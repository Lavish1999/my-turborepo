'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class DeploymentRequest extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    };
    DeploymentRequest.init({
        deployment_id : DataTypes.TEXT,
        project_id : DataTypes.INTEGER,
        prompt : DataTypes.TEXT,
        response : DataTypes.TEXT,
        status_code : DataTypes.INTEGER,
        cost : DataTypes.FLOAT,
        tags : DataTypes.STRING,                                                                                                                     
        providers : DataTypes.INTEGER,
        response_time : DataTypes.INTEGER,

        model : DataTypes.STRING,
        input_tokens : DataTypes.INTEGER,
        output_tokens : DataTypes.INTEGER,
        total_tokens : DataTypes.INTEGER, 
    }, {
        sequelize,
        modelName: 'DeploymentRequest',
        tableName: 'llmspark_deployment_requests',
        timestamps: { createdAt: "created_at" },
        updatedAt: false,
        underscored: true,
    });
    return DeploymentRequest;
};