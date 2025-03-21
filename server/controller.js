const axios = require("axios");
const LOGIN_API = "http://localhost:9047/apiv2/login";
const DREMIO_API = "http://localhost:9047/api/v3/sql";
const DREMIO_JOB_API = "http://localhost:9047/api/v3/job";

const sleep = (waitInMin) => new Promise(resolve => setTimeout(resolve, waitInMin));

exports.createPeople = async (req, res) => {
    try {
        const query = "insert into nessie.people(id,first_name,last_name,age) values(" + req.body.id + ",'" + req.body.first_name + "','" + req.body.last_name + "'," + req.body.age + ")";

        console.log(query);

        const token = await getLoginToken();
        const response = await axios.post(
            DREMIO_API,
            { sql: query },
            { headers: { Authorization: `Bearer ${token}` } }
        ).catch((err) => {
            console.log("error", err);

        });

        const jobStatus = await getJobStatus(response.data.id, token);

        if (jobStatus === 'COMPLETED') {
            res.status(200).json({ success: true, message: 'Create success' })
        } else {
            res.status(500).json({ success: false, message: 'Create failed' })
        }
    } catch (error) {
        console.log("errors", error);
        res.status(500).json({ success: false });
    }
}

exports.insertData = async (req, res) => {
    try {
        console.log("==========================")
        const query =`INSERT INTO nessie.peopleData (id, first_name, last_name, age) 
        SELECT 
            ROW_NUMBER() OVER () AS id,
            CONCAT('firstName', ROW_NUMBER() OVER ()) AS first_name,
            CONCAT('lastName', ROW_NUMBER() OVER ()) AS last_name,
            ROW_NUMBER() OVER () AS age
        FROM (
            SELECT 1 FROM 
            (SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1
             UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1) t1
            CROSS JOIN 
            (SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1
             UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1) t2
        ) tmp
        LIMIT 100`;
        console.log(query);

        const token = await getLoginToken();
        const response = await axios.post(
            DREMIO_API,
            { sql: query },
            { headers: { Authorization: `Bearer ${token}` } }
        ).catch((err) => {
            console.log("error", err);

        });

        const jobStatus = await getJobStatus(response.data.id, token);

        if (jobStatus === 'COMPLETED') {
            res.status(200).json({ success: true, message: 'data inserted' })
        } else {
            res.status(500).json({ success: false, message: 'Create failed' })
        }
    } catch (error) {
        console.log("errors", error);
        res.status(500).json({ success: false });
    }
}
exports.updatePeople = async (req, res) => {
    console.log(req.body,"================");
    try {

        const query = `UPDATE nessie.peopleData 
               SET first_name='${req.body.first_name}', 
                   last_name='${req.body.last_name}', 
                   age=${req.body.age} 
               WHERE id=${req.params['id']}`;

        // const query = `update nessie.peopleData set first_name= + ${req.body.first_name} + ",last_name=" + req.body.last_name + ",age=" + req.body.age + " where id=" + req.params['id'];
        const token = await getLoginToken();
        const response = await axios.post(
            DREMIO_API,
            { sql: query },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const jobStatus = await getJobStatus(response.data.id, token);

        if (jobStatus === 'COMPLETED') {
            res.status(200).json({ success: true, message: 'Update success' })
        } else {
            res.status(500).json({ success: false, message: 'Update failed' })
        }
    } catch (error) {
        console.log("errors", error);
        res.status(500).json({ success: false });
    }
}


exports.getPeoples = async (req, res) => {
    try {
        const query = "SELECT * FROM nessie.peopleData";
        debugger
        const token = await getLoginToken();

        const response = await axios.post(
            DREMIO_API,
            { sql: query },
            { headers: { Authorization: `Bearer ${token}` } }
        );


        const { jobResults, status } = await getQueryResult(response.data.id, token);
        if (status === 'COMPLETED') {
            res.status(200).json({ records: jobResults })
        } else {
            res.status(500).json({ status: status })
        }
    } catch (error) {
        console.log("errors", error);
        res.status(500).json({ success: false });
    }
}

exports.deletePeople = async (req, res) => {
    try {
        const query = "delete FROM nessie.peopleData where id=" + req.params['id'];
        const token = await getLoginToken();

        console.log("query: " + query );

        const response = await axios.post(
            DREMIO_API,
            { sql: query },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const jobStatus = await getJobStatus(response.data.id, token);

        console.log("jobStatus ", jobStatus);

        if (jobStatus === 'COMPLETED') {
            res.status(200).json({ success: true, message: 'Delete success' })
        } else {
            res.status(500).json({ success: false, message: 'Delete failed' })
        }
    } catch (error) {
        console.log("errors", error);
        res.status(500).json({ success: false });
    }
}

async function getLoginToken() {
    debugger
    const loginResponse = await axios.post(
        LOGIN_API,
        { userName: "angoth.prashanth", password: "Nandu@998985" }
    );

    const token = loginResponse.data.token;

    return token;
}


async function getQueryResult(queryId, token) {

    let jobStatus = await getJobStatus(queryId, token);

    if (jobStatus !== 'COMPLETED') {
        return { jobResults: [], status: jobStatus };
    }

    const response = await axios.get(
        DREMIO_JOB_API + "/" + queryId + "/results",
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return { jobResults: response.data, status: jobStatus };
}

async function getJobStatus(queryId, token) {
    let jobStatus;
    let error;
    do {
        await sleep(5000);
        const response = await axios.get(
            DREMIO_JOB_API + "/" + queryId,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        jobStatus = response.data.jobState;
        error = response.data.errorMessage;

    } while (jobStatus !== 'COMPLETED' && jobStatus!= 'FAILED');

    console.log("Job status: ", jobStatus);
    console.log("error : ",  error)

    return jobStatus;
}
