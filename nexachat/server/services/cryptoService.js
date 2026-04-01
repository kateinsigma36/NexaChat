/**
 * Сервис шифрования для E2E (End-to-End) шифрования сообщений
 * Использует AES-256-GCM для шифрования содержимого сообщений
 */

const crypto = require('crypto');
const { logger } = require('../utils/helpers');

// Алгоритм шифрования
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 байт для AES
const TAG_LENGTH = 16; // 16 байт для GCM auth tag
const SALT_LENGTH = 32; // 32 байта для соли

/**
 * Генерация случайных байт
 * @param {number} length - количество байт
 * @returns {Buffer} случайные байты
 */
const generateRandomBytes = (length) => {
  return crypto.randomBytes(length);
};

/**
 * Derive ключ из пароля/секрета с использованием PBKDF2
 * @param {string} secret - секретная фраза
 * @param {Buffer} salt - соль
 * @returns {Buffer} 32-байтовый ключ
 */
const deriveKey = (secret, salt) => {
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
};

/**
 * Шифрование сообщения
 * @param {string} text - текст для шифрования
 * @param {string} secret - секретный ключ (пароль или производный ключ)
 * @returns {Object} объект с encrypted, iv, salt, tag (в base64)
 */
const encrypt = (text, secret) => {
  try {
    // Генерируем соль и IV
    const salt = generateRandomBytes(SALT_LENGTH);
    const iv = generateRandomBytes(IV_LENGTH);
    
    // Derive ключ из секрета
    const key = deriveKey(secret, salt);
    
    // Создаём cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Шифруем данные
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Получаем auth tag
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64')
    };
  } catch (error) {
    logger.error(`Ошибка шифрования: ${error.message}`);
    throw new Error('Не удалось зашифровать сообщение');
  }
};

/**
 * Дешифрование сообщения
 * @param {Object} encryptedData - объект {encrypted, iv, salt, tag}
 * @param {string} secret - секретный ключ
 * @returns {string} дешифрованный текст
 */
const decrypt = (encryptedData, secret) => {
  try {
    const { encrypted, iv, salt, tag } = encryptedData;
    
    // Конвертируем из base64
    const ivBuffer = Buffer.from(iv, 'base64');
    const saltBuffer = Buffer.from(salt, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    
    // Derive ключ из секрета
    const key = deriveKey(secret, saltBuffer);
    
    // Создаём decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    
    // Дешифруем данные
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error(`Ошибка дешифрования: ${error.message}`);
    throw new Error('Не удалось дешифровать сообщение');
  }
};

/**
 * Хеширование данных (для проверки целостности)
 * @param {string} data - данные для хеширования
 * @returns {string} SHA-256 хеш в hex
 */
const hash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Генерация пары ключей для обмена (Diffie-Hellman упрощённый)
 * В production следует использовать полноценную реализацию Signal Protocol
 * @returns {Object} { publicKey, privateKey }
 */
const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1' // P-256 кривая
  });
  
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
};

/**
 * Вычисление общего секрета (ECDH)
 * @param {string} privateKeyPem - приватный ключ в PEM
 * @param {string} otherPublicKeyPem - публичный ключ другой стороны в PEM
 * @returns {string} общий секрет в hex
 */
const computeSharedSecret = (privateKeyPem, otherPublicKeyPem) => {
  const otherPublicKey = crypto.createPublicKey(otherPublicKeyPem);
  const ecdh = crypto.createECDH('prime256v1');
  
  ecdh.setPrivateKey(crypto.createPrivateKey(privateKeyPem));
  
  return ecdh.computeSecret(otherPublicKey).toString('hex');
};

/**
 * Шифрование файла (потоковое)
 * @param {Buffer} fileBuffer - буфер файла
 * @param {string} secret - секретный ключ
 * @returns {Object} { encrypted, iv, salt, tag }
 */
const encryptFile = (fileBuffer, secret) => {
  try {
    const salt = generateRandomBytes(SALT_LENGTH);
    const iv = generateRandomBytes(IV_LENGTH);
    const key = deriveKey(secret, salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(fileBuffer);
    const final = cipher.final();
    const tag = cipher.getAuthTag();
    
    encrypted = Buffer.concat([encrypted, final]);
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64')
    };
  } catch (error) {
    logger.error(`Ошибка шифрования файла: ${error.message}`);
    throw new Error('Не удалось зашифровать файл');
  }
};

/**
 * Дешифрование файла
 * @param {Object} encryptedData - { encrypted, iv, salt, tag }
 * @param {string} secret - секретный ключ
 * @returns {Buffer} дешифрованный буфер файла
 */
const decryptFile = (encryptedData, secret) => {
  try {
    const { encrypted, iv, salt, tag } = encryptedData;
    
    const ivBuffer = Buffer.from(iv, 'base64');
    const saltBuffer = Buffer.from(salt, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    const key = deriveKey(secret, saltBuffer);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    
    let decrypted = decipher.update(encryptedBuffer);
    const final = decipher.final();
    
    return Buffer.concat([decrypted, final]);
  } catch (error) {
    logger.error(`Ошибка дешифрования файла: ${error.message}`);
    throw new Error('Не удалось дешифровать файл');
  }
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateKeyPair,
  computeSharedSecret,
  encryptFile,
  decryptFile,
  ALGORITHM,
  IV_LENGTH,
  TAG_LENGTH,
  SALT_LENGTH
};
