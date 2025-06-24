class IConfigRepository {
  async saveCredentials(username, password) {
    throw new Error('Method saveCredentials() must be implemented');
  }

  async getCredentials() {
    throw new Error('Method getCredentials() must be implemented');
  }

  async isConfigured() {
    throw new Error('Method isConfigured() must be implemented');
  }

  async saveConfig(key, value) {
    throw new Error('Method saveConfig() must be implemented');
  }

  async getConfig(key) {
    throw new Error('Method getConfig() must be implemented');
  }

  async deleteConfig(key) {
    throw new Error('Method deleteConfig() must be implemented');
  }

  async getAllConfig() {
    throw new Error('Method getAllConfig() must be implemented');
  }

  async clearAllConfig() {
    throw new Error('Method clearAllConfig() must be implemented');
  }
}

module.exports = IConfigRepository;