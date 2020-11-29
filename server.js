const express = require('express');
const fileUpload = require('express-fileupload');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const Parcel = require('@oasislabs/parcel-sdk');

const port = process.env.PORT || 3000;
const app = express();
app.use(fileUpload());
app.use(express.json());

const configParams = Parcel.Config.paramsFromEnv();
const config = new Parcel.Config(configParams);

const mongoHost = process.env.MONGO_HOST || 'mongodb';
const mongoDB = `mongodb://${mongoHost}/compute`;
mongoose.connect(mongoDB, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));


const Schema = mongoose.Schema;
const DatasetSchema = new Schema({
    title: String,
    address: String
});
const DatasetModel = mongoose.model('DatasetModel', DatasetSchema);
const ComputeSchema = new Schema({
    jobId: String,
    status: String,
    info: String,
    outputs: Array
});
const ComputeModel = mongoose.model('ComputeModel', ComputeSchema);


app.get('/', (request, response) => {
    return response.send('ok');
});

app.post('/upload', async (request, response) => {
    if (!request.files) {
        return response.status(400).send({
            message: 'No file uploaded'
        });
    }
    if (!request.body || !request.body.title) {
        return response.status(400).send({
            message: 'title is required'
        });
    }
    const title = request.body.title;
    const file = request.files.file.data;
    const identity = await config.getTokenIdentity();
    const dataset = await Parcel.Dataset.upload(
        file,
        {title: title},
        identity,
        config,
    );
    const datasetAddress = dataset.address;
    const datasetInstance = new DatasetModel({title: title, address: datasetAddress._hex});
    await datasetInstance.save();
    return response.send({
        message: 'file is uploaded',
        address: datasetAddress._hex
    });
});


app.get('/datasets', (request, response) => {
    DatasetModel.find().lean().exec(function (err, datasets) {
        return response.end(JSON.stringify(datasets));
    });
});


app.get('/dataset/:address', async (request, response) => {
    if (!request.params.address) {
        return response.status(400).send({
            message: 'address is missing'
        });
    }
    const address = new Parcel.Address(request.params.address);
    const identity = await config.getTokenIdentity();
    const dataset = await Parcel.Dataset.connect(address, identity, config);
    console.log(dataset);
    const filePath = path.join(os.tmpdir(), request.params.address);
    await dataset.downloadToPath(filePath);
    return response.sendFile(filePath);
});


app.post('/compute', async (request, response) => {
    const data = request.body;
    const name = data.name;
    if (!name) {
        return response.status(400).send({
            message: 'name is missing'
        });
    }
    const dockerImage = data.dockerImage;
    if (!dockerImage) {
        return response.status(400).send({
            message: 'dockerImage is missing'
        });
    }
    const inputDatasets = data.inputDatasets;
    if (!inputDatasets) {
        return response.status(400).send({
            message: 'inputDatasets is missing'
        });
    }
    const outputDatasets = data.outputDatasets;
    if (!outputDatasets) {
        return response.status(400).send({
            message: 'outputDatasets is missing'
        });
    }
    const cmd = data.cmd;
    if (!cmd) {
        return response.status(400).send({
            message: 'cmd is missing'
        });
    }
    const identity = await config.getTokenIdentity();
    inputDatasets.forEach(function (part, index, datasets) {
        datasets[index]['address'] = new Parcel.Address(datasets[index]['address']);
    });
    outputDatasets.forEach(function (part, index, datasets) {
        datasets[index]['owner'] = identity;
    });
    const dispatcher = await Parcel.Dispatcher.connect(config.dispatcherAddress, identity, config);
    const jobRequest = {
        name: name,
        dockerImage: dockerImage,
        inputDatasets: inputDatasets,
        outputDatasets: outputDatasets,
        cmd: cmd
    };
    console.log(jobRequest);
    let jobId = await dispatcher.submitJob({job: jobRequest});
    jobId = Parcel.utils.encodeHex(jobId);
    console.log(jobId);
    const computeInstance = new ComputeModel({jobId: jobId});
    await computeInstance.save();
    return response.send({
        message: 'job is submitted',
        jobId: jobId
    });
});


app.get('/jobs', (request, response) => {
    ComputeModel.find().lean().exec(function (err, compute) {
        return response.end(JSON.stringify(compute));
    });
});


app.get('/job/:jobId', async (request, response) => {
    let jobId = request.params.jobId;
    if (!jobId) {
        return response.status(400).send({
            message: 'jobId is missing'
        });
    }
    let jobIdHex = jobId;
    jobId = Parcel.utils.decodeHex(jobId);
    const identity = await config.getTokenIdentity();
    const dispatcher = await Parcel.Dispatcher.connect(config.dispatcherAddress, identity, config);
    const job = await dispatcher.getJobInfo(jobId);
    console.log(job);
    let status = '';
    if (job.status instanceof Parcel.JobCompletionStatus.Success) {
        status = 'Success'
    } else if (job.status instanceof Parcel.JobCompletionStatus.JobSetupError) {
        status = 'JobSetupError'
    } else if (job.status instanceof Parcel.JobCompletionStatus.RuntimeError) {
        status = 'RuntimeError'
    } else if (job.status instanceof Parcel.JobCompletionStatus.Pending) {
        status = 'Pending'
    } else if (job.status instanceof Parcel.JobCompletionStatus.Cancelled) {
        status = 'Cancelled'
    }
    const info = job.info;
    let outputs = job.outputs;
    outputs.forEach(function (part, index, datasets) {
        datasets[index]['address'] = datasets[index]['address']._hex;
    });
    await ComputeModel.findOneAndUpdate({jobId: jobIdHex},
        {status: status, info: info, outputs: outputs}, {returnOriginal: false});
    return response.send({
        jobStatus: status,
        info: info,
        outputs: outputs
    });
});


app.listen(port, (err) => {
    if (err) {
        return console.log(err)
    }
    console.log(`server is listening on ${port}`)
});
