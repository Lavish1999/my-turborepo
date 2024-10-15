'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Prompt extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    };
    Prompt.init({
        integration_id : DataTypes.INTEGER,
        prompt_message : DataTypes.STRING,
    }, {
        sequelize,
        modelName: 'Prompt',
        tableName: 'prompts',
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at'},
        underscored: true,
    });
    return Prompt;
};