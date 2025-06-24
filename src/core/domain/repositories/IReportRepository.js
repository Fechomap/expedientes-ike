class IReportRepository {
  async save(report) {
    throw new Error('Method save() must be implemented');
  }

  async findById(id) {
    throw new Error('Method findById() must be implemented');
  }

  async findAll() {
    throw new Error('Method findAll() must be implemented');
  }

  async findByType(type) {
    throw new Error('Method findByType() must be implemented');
  }

  async findByDateRange(startDate, endDate) {
    throw new Error('Method findByDateRange() must be implemented');
  }

  async update(report) {
    throw new Error('Method update() must be implemented');
  }

  async delete(id) {
    throw new Error('Method delete() must be implemented');
  }

  async exists(id) {
    throw new Error('Method exists() must be implemented');
  }

  async getLatest(limit = 10) {
    throw new Error('Method getLatest() must be implemented');
  }
}

module.exports = IReportRepository;