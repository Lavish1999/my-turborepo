'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class SessionData extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
             this.myAssociation=models.SessionData.belongsTo(models.Session, { foreignKey: "session_id" , as: 'data_session'});
             this.myAssociation=models.Session.hasMany(models.SessionData,   { foreignKey: "session_id" , as: 'session_data'});
        }
    };
    SessionData.init({
        session_id :DataTypes.INTEGER,
        key: DataTypes.STRING,
        value: DataTypes.STRING
    }, {
        sequelize,
        modelName: 'SessionData',
        tableName: 'session_data',
        timestamps: false,
        underscored: true,
    });
    return SessionData;
};