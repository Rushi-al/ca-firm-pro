/**
 * Multi-tenant seed — creates 2 separate firms with isolated data
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Firm     = require('./models/Firm');
const User     = require('./models/User');
const Client   = require('./models/Client');
const Task     = require('./models/Task');

const ago = d => new Date(Date.now() - d * 864e5);
const fwd = d => new Date(Date.now() + d * 864e5);

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Clean all
  await Promise.all([Firm.deleteMany(), User.deleteMany(), Client.deleteMany(), Task.deleteMany()]);
  console.log('🧹 Cleared existing data\n');

  // ── FIRM 1: Mehta & Associates ──────────────────────────
  const firm1 = await Firm.create({ name: 'Mehta & Associates', ownerEmail: 'priya@mehta.com', phone: '9876543210', plan: 'pro' });
  const f1owner = await User.create({ firmId: firm1._id, name: 'Priya Mehta',  email: 'priya@mehta.com',  password: 'Admin@123', role: 'Owner'    });
  const f1admin = await User.create({ firmId: firm1._id, name: 'Arjun Mehta',  email: 'arjun@mehta.com',  password: 'Admin@123', role: 'Admin'    });
  const f1emp1  = await User.create({ firmId: firm1._id, name: 'Rajesh Shah',  email: 'rajesh@mehta.com', password: 'Emp@12345', role: 'Employee' });
  const f1emp2  = await User.create({ firmId: firm1._id, name: 'Anita Patel',  email: 'anita@mehta.com',  password: 'Emp@12345', role: 'Employee' });

  const f1c1 = await Client.create({ firmId: firm1._id, name: 'TechVision Pvt Ltd',  contact: '9876543210', gstNumber: '24AABCT1234D1Z5', createdBy: f1owner._id });
  const f1c2 = await Client.create({ firmId: firm1._id, name: 'Sunrise Textiles',    contact: '9765432109', gstNumber: '24AABST5678D1Z3', createdBy: f1owner._id });
  const f1c3 = await Client.create({ firmId: firm1._id, name: 'Metro Builders',      contact: '9654321098', createdBy: f1owner._id });

  await Task.create([
    { firmId: firm1._id, title: 'GST Return Filing Q1',     clientId: f1c1._id, assignedTo: f1emp1._id, priority: 'High',   deadline: ago(5),  progress: 100 },
    { firmId: firm1._id, title: 'Income Tax Assessment',    clientId: f1c2._id, assignedTo: f1emp2._id, priority: 'High',   deadline: fwd(3),  progress: 60  },
    { firmId: firm1._id, title: 'Annual Audit 2023-24',     clientId: f1c3._id, assignedTo: f1emp1._id, priority: 'Medium', deadline: ago(2),  progress: 40  },
    { firmId: firm1._id, title: 'TDS Reconciliation',       clientId: f1c1._id, assignedTo: f1emp2._id, priority: 'Low',    deadline: fwd(10), progress: 0   },
    { firmId: firm1._id, title: 'Balance Sheet Prep',       clientId: f1c2._id, assignedTo: f1emp1._id, priority: 'Medium', deadline: ago(1),  progress: 0   },
  ]);

  console.log('🏢 FIRM 1: Mehta & Associates (Pro Plan)');
  console.log('   Owner:    priya@mehta.com    / Admin@123');
  console.log('   Admin:    arjun@mehta.com    / Admin@123');
  console.log('   Employee: rajesh@mehta.com   / Emp@12345');
  console.log('   Employee: anita@mehta.com    / Emp@12345\n');

  // ── FIRM 2: Shah Tax Consultants ────────────────────────
  const firm2 = await Firm.create({ name: 'Shah Tax Consultants', ownerEmail: 'owner@shah.com', phone: '9123456789', plan: 'free' });
  const f2owner = await User.create({ firmId: firm2._id, name: 'Vikram Shah',   email: 'owner@shah.com',  password: 'Admin@123', role: 'Owner'    });
  const f2emp1  = await User.create({ firmId: firm2._id, name: 'Neha Joshi',    email: 'neha@shah.com',   password: 'Emp@12345', role: 'Employee' });

  const f2c1 = await Client.create({ firmId: firm2._id, name: 'GreenLeaf Farms',   contact: '9543210987', gstNumber: '24AABGF9012D1Z1', createdBy: f2owner._id });
  const f2c2 = await Client.create({ firmId: firm2._id, name: 'Digital Media Hub', contact: '9432109876', createdBy: f2owner._id });

  await Task.create([
    { firmId: firm2._id, title: 'Payroll Processing March',  clientId: f2c1._id, assignedTo: f2emp1._id, priority: 'High',   deadline: fwd(5),  progress: 50 },
    { firmId: firm2._id, title: 'ROC Annual Compliance',     clientId: f2c2._id, assignedTo: f2emp1._id, priority: 'High',   deadline: fwd(7),  progress: 75 },
  ]);

  console.log('🏢 FIRM 2: Shah Tax Consultants (Free Plan)');
  console.log('   Owner:    owner@shah.com     / Admin@123');
  console.log('   Employee: neha@shah.com      / Emp@12345\n');

  console.log('🎉 Multi-tenant seed complete!');
  console.log('👉 Firms are 100% isolated — logging into one firm cannot see the other\'s data.\n');
  process.exit(0);
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
