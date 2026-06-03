param location string = resourceGroup().location
param storageAccountName string = 'meltimediastorage${uniqueString(resourceGroup().id)}'
param environment string = 'prod'

// Storage account for multimedia content
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS' // Locally redundant storage for cost efficiency
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true // Enable public access to blobs
    minimumTlsVersion: 'TLS1_2'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow' // Allow all traffic for public access
    }
  }
}

// Blob service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

// Video container with public read access
resource videoContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'videos'
  properties: {
    publicAccess: 'Blob' // Public read access to blobs
  }
}

// Audio container with public read access
resource audioContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'audio'
  properties: {
    publicAccess: 'Blob' // Public read access to blobs
  }
}

// Transcripts container with public read access
resource transcriptsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'transcripts'
  properties: {
    publicAccess: 'Blob' // Public read access to blobs
  }
}

// Output the storage account details for use in the backend
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output videoContainerUrl string = '${storageAccount.properties.primaryEndpoints.blob}videos/'
output audioContainerUrl string = '${storageAccount.properties.primaryEndpoints.blob}audio/'
output transcriptsContainerUrl string = '${storageAccount.properties.primaryEndpoints.blob}transcripts/'
