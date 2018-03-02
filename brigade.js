const {
  events,
  Job,
  Group
} = require('brigadier');

// -----
// UTILS
// -----

padLeft = function(num) {
  return new Array(2 - num.length + 1).join('0') + num;
}

Date.prototype.Format = function() {
  var year = this.getFullYear()
  var month = padLeft((this.getMonth() + 1).toString())
  var day = padLeft(this.getDate().toString())
  return year + "-" + month + "-" + day
}

// -----
// Import Sales Job
// -----

function ImportSalesJob(customer, network, account, date) {
  this.customer = customer;
  this.network = network;
  this.account = account;
  this.date = date;
};

createHashIndex = function(key) {
  var hash = 0;
  for (var i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash = hash >>> 0; //convert to 32bit unsigned integer
  }
  return Math.abs(hash % 10000);
}

ImportSalesJob.prototype.generate = function(payload, secrets) {
  const name = "import-sales-" + createHashIndex(this.customer + this.network + this.account + this.date);
  const job = new Job(name, "registry.usw.co/uswitch/ldn/ldn-import-sales:aa0f44f3106ca8bc71007bf2aec4d3e9a55d3a03");

  job.tasks = [
    "java -Xmx400M -Xms400M -jar target/ldn-import-sales.jar " +
    this.customer + " " +
    "sales " +
    this.network + " " +
    this.account + " " +
    this.date
  ];

  job.env = {
    "ACCOUNTS": payload.accounts,
    "AURORA_LDN_HOST": secrets.aurora_ldn_host,
    "AURORA_LDN_USERNAME": secrets.aurora_ldn_username,
    "AURORA_LDN_PASSWORD": secrets.aurora_ldn_password,
  };

  return job;
};

events.on("my_event", (brigadeEvent, project) => {
  const importJobs = [];
  const now = new Date();

  const payload = JSON.parse(brigadeEvent.payload);
  const numDays = payload.num_days

  importSalesConfigs = [{
    customer: "mobiles",
    network: "awin",
    account: "63862"
  }, {
    customer: "banking",
    network: "omd-performance",
    account: "10"
  }, {
    customer: "banking",
    network: "omd-performance",
    account: "4"
  }];

  importSalesConfigs.forEach(config => {
    const start = new Date(now);
    start.setDate(start.getDate() - 1)

    for (start; start <= now; start.setDate(start.getDate() + 1)) {
      const date = (new Date(start)).Format();
      importJobs.push((new ImportSalesJob(config.customer, config.network, config.account, date)).generate(payload, project.secrets));
    }
  });

  console.log("Running %d jobs", importJobs.length);
  Group.runAll(importJobs);
})
