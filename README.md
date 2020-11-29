## Privacy Compute Platform
Privacy Compute Platform allows you to run complex compute jobs in Oasis secure enclaves, enabling you to analyze 
sensitive data and provide valuable services to your users while maintaining their privacy.

## Getting Started

1. Clone repo

   ```
   git clone https://github.com/viraja1/privacy_compute_platform.git
   cd privacy_compute_platform
   ``` 

2. Install Docker and Docker Compose
   ```
   https://docs.docker.com/engine/install/#server
   https://docs.docker.com/compose/install/
   ```
   
3. Install Go 1.15

   https://golang.org/dl/
   
   Once Go is installed then add the following to ~/.bashrc

   ```
   export GOPATH=$HOME/go
   export PATH="$GOPATH/bin:$PATH"
   ```
   
   Then run the following command
   ```
   source ~/.bashrc
   ```
   
4. Install jwk-keygen Go package

   ```
   go get -u gopkg.in/square/go-jose.v2/jwk-keygen
   ```
   
5. Generate a P256 ECDSA keypair
    
   ```
   $GOPATH/bin/jwk-keygen --alg=ES256 --use=sig
   ```
   
   Note down the public key (.pub) and private key shown in the terminal
   
6. Login to npm to access @oasislabs/parcel-sdk package (account needs to have access to the private package)

   ```
   npm login
   ```
   
7. Copy .npmrc to the current repo directory

   ```
   npm config ls -l
   ```
   
   From the output of the above command, note down the path of .npmrc in userconfig
   
   Then copy .npmrc to the current repo directory
   
8. Register your App

   Register your app and your public key (denoted with a .pub file extension) in Parcel Portal 
   (https://portal.oasiscloud.io/new-app). Then generate a client ID and note it down
   
9. Generate .env file

   ```
   vi .env
   ```
   
   Then add OASIS_CLIENT_ID and OASIS_API_PRIVATE_KEY in .env
   
   ```
   OASIS_CLIENT_ID=
   OASIS_API_PRIVATE_KEY=
   ```   
   
10. Build docker image

    ```
    docker-compose build
    ```
   
11. Run the containers

    ```
    docker-compose up -d
    ```
    
    Then wait for 45 seconds for the containers to come up. Verify using status check url
    ```
    curl -i localhost:3000/
    ```
    
    Logs
    ```
    docker logs -f privacy_compute_platform_app_1
    ```
    
 ## API Flow for sample compute job
 
 1. Upload Dataset
 
    ```
    curl -i localhost:3000/upload  -F title=skin-lesion-classification -F file=@basal_cell_carcinoma_example.jpg 
    ```
    
    Output
    
    ```
    {"message": "file is uploaded", "address": "0x1545723a247478883453801976a62b3431dd7ca5"}
    ```
    
 2. Check list of available datasets
 
    ```
    curl -i localhost:3000/datasets
    ```
    
    Output
    
    ```
    [{"_id":"5fc3d1ce0bef090012cc3e85","title":"skin-lesion-classification","address":"0x1545723a247478883453801976a62b3431dd7ca5"}]
    ```
    
 3. Check if dataset is downloadable
 
    ```
    curl localhost:3000/dataset/{address} -o test.jpg
    ```
    
    Replace {address} with the output from the previous steps. Then open test.jpg once download is successful
    
 4. Run the compute job
 
    ```
    curl -i -XPOST localhost:3000/compute -d '{"name":"skin-lesion-classification","dockerImage":"oasislabs/acme-derma-demo","inputDatasets":[{"mountPath":"skin.jpg","address":"{address}"}],"outputDatasets":[{"mountPath":"prediction.txt"}],"cmd":["python","predict.py","/parcel/data/in/skin.jpg","/parcel/data/out/prediction.txt"]}' -H 'Content-Type: application/json'
    ```
    
    Replace {address} with the output from the previous steps.
    
    Output
    
    ```
    {"message":"job is submitted","jobId":"0x3d4d2d74aa891c694c828f46977902455f85ba594679901fcb7115f1b2b69cce"}
    ```
    
 5. Check the list of submitted jobs
  
     ```
     curl -i localhost:3000/jobs    
     ```
    
     Output
     
     ```
     [{"_id":"5fc3d9375e10cc0012a28fd1","outputs":[],"jobId":"0x3d4d2d74aa891c694c828f46977902455f85ba594679901fcb7115f1b2b69ccee"}]
     ```
    
 6. Check the job status
 
    ```
    curl -i localhost:3000/job/{jobId}
    ```
    
    Replace {jobId} with the output from the previous steps.
    
    Output
    
    ```
    {"jobStatus":"Success","info":"","outputs":[{"mountPath":"prediction.txt","address":"0x34b4843946d6776f9ff78b1ab0349f7a4fbbe1ea"}]}
    ```
    
    Note down the address shown in the above output. It will be required to fetch the job result.
    
 7. Check the job result
 
    ```
    curl localhost:3000/dataset/{address} -o result.txt
    cat result.txt
    ```
    
    Replace {address} with the value from the previous output
    