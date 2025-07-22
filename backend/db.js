import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  "postgres://postgres:postp@ss@localhost:5432/chatapp_db",
  {
    logging: false,
    dialect: "postgres",
  }
);

export default sequelize;
