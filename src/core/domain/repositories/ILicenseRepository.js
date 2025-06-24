class ILicenseRepository {
  async save(license) {
    throw new Error('Method save() must be implemented');
  }

  async findByToken(token) {
    throw new Error('Method findByToken() must be implemented');
  }

  async findCurrent() {
    throw new Error('Method findCurrent() must be implemented');
  }

  async update(license) {
    throw new Error('Method update() must be implemented');
  }

  async delete(token) {
    throw new Error('Method delete() must be implemented');
  }

  async exists(token) {
    throw new Error('Method exists() must be implemented');
  }
}

module.exports = ILicenseRepository;