const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Group = require('../../src/models/group.model');

describe('Group Routes', () => {
  let token;
  let user;

  beforeEach(async () => {
    user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    token = generateTestToken(user._id);
  });

  describe('POST /groups/create', () => {
    it('should create a new group', async () => {
      const response = await request(app)
        .post('/groups/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Group',
          currency: 'USD',
          members: ['test@example.com', 'member@example.com']
        });

      expect(response.status).toBe(201);
      expect(response.body.groupId).toBeDefined();

      // Verify group was created
      const group = await Group.findById(response.body.groupId);
      expect(group.name).toBe('Test Group');
      expect(group.members).toContain('test@example.com');
    });
  });

  describe('GET /groups/:groupId', () => {
    let group;

    beforeEach(async () => {
      group = await Group.create({
        name: 'Test Group',
        currency: 'USD',
        members: ['test@example.com']
      });
    });

    it('should get group details for member', async () => {
      const response = await request(app)
        .get(`/groups/${group._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Test Group');
    });

    it('should not get group details for non-member', async () => {
      const nonMemberUser = await User.create({
        name: 'Non Member',
        email: 'nonmember@example.com',
        password: 'password123'
      });
      const nonMemberToken = generateTestToken(nonMemberUser._id);

      const response = await request(app)
        .get(`/groups/${group._id}`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(403);
    });
  });
}); 