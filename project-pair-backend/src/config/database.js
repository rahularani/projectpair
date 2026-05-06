import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'
dotenv.config()

const sslEnabled = process.env.DB_SSL === 'true'

const sequelize = new Sequelize(
  process.env.DB_NAME || 'projectpair',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: sslEnabled ? {
      ssl: { rejectUnauthorized: false }
    } : {},
  }
)

export default sequelize
