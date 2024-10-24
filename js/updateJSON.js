document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('itemType').addEventListener('change', function() {
        const itemType = this.value;
        if (itemType) {
            const jsonFileName = `data/${itemType}.json`; // Construct the filename with the correct folder path

            // Fetch the data to determine the highest ID
            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    // Find the largest ID in the existing data
                    let maxId = fileData.reduce((max, item) => Math.max(max, parseInt(item.id, 10)), 0);
                    
                    // Set the ID field to maxId + 1
                    document.getElementById('id').value = maxId + 1;
                })
                .catch(error => {
                    console.error(`Error fetching ${jsonFileName}:`, error);
                    alert('An error occurred while fetching the file.');
                });
        }
    });

    document.getElementById('dataForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission

        const itemType = document.getElementById('itemType').value; // Get the value from dropdown
        const jsonFileName = `data/${itemType}.json`; // Construct the filename dynamically with the data folder

        const newData = {
            id: document.getElementById('id').value,
            title: document.getElementById('title').value,
            franchise: document.getElementById('franchise').value,
            description: document.getElementById('description').value,
            size: document.getElementById('size').value,
            source: document.getElementById('source').value,
            personalized: document.getElementById('personalized').value,
            is_verified: document.getElementById('is_verified').value,
            serialnumber: document.getElementById('serialnumber').value,
            original_cost: document.getElementById('original_cost').value,
            current_value: document.getElementById('current_value').value,
            image: document.getElementById('image').value
        };

        fetch(jsonFileName)
            .then(response => response.json())
            .then(fileData => {
                // Add the new item to the existing data
                fileData.push(newData);

                // Convert the updated data to JSON
                const updatedJson = JSON.stringify(fileData, null, 2);

                // Create a blob from the updated JSON string
                const blob = new Blob([updatedJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = jsonFileName.replace('data/', ''); // Download without the data/ prefix

                // Append the link to the document body and trigger the download
                document.body.appendChild(a);
                a.click();

                // Clean up
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error(`Error fetching ${jsonFileName}:`, error);
                alert('An error occurred while updating the file.');
            });
    });
});
