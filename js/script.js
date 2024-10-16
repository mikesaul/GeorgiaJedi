// Define detailFormatter function globally
function detailFormatter(index, row) {
  var html = [];

  // Start card container
  html.push('<div class="card" style="display: flex; border: 1px solid #ddd; padding: 10px;">');

  // Left side - Image
  html.push('<div class="card-left" style="flex: 1; text-align: center;">');
  if (row.image) {
      html.push('<img src="images/thumbs/' + row.image + '_thumb.jpg" style="width: 150px; height: 150px; border-radius: 5px;" alt="Item Image">');
  } else {
      html.push('<img src="images/100.png" style="width: 150px; height: 150px; border-radius: 5px;" alt="No Image">');
  }
  html.push('</div>');  // End left side

  // Right side - Details
  html.push('<div class="card-right" style="flex: 2; padding-left: 20px;">');

  // Add title, franchise, description, size, source, serialnumber, original cost, current value
  if (row.title) {
      html.push('<h3 style="margin-top: 0;">' + row.title + '</h3>');
  }
  if (row.franchise) {
      html.push('<p><b>Franchise:</b> ' + row.franchise + '</p>');
  }
  if (row.description) {
      html.push('<p><b>Description:</b> ' + row.description + '</p>');
  }
  if (row.size) {
      html.push('<p><b>Size:</b> ' + row.size + '</p>');
  }
  if (row.source) {
      html.push('<p><b>Source:</b> ' + row.source + '</p>');
  }
  if (row.serialnumber) {
      html.push('<p><b>Serial Number:</b> ' + row.serialnumber + '</p>');
  }
  if (row.original_cost) {
      html.push('<p><b>Original Cost:</b> $' + row.original_cost + '</p>');
  }
  if (row.current_value) {
      html.push('<p><b>Current Value:</b> $' + row.current_value + '</p>');
  }

  html.push('</div>');  // End right side
  html.push('</div>');  // End card container

  return html.join('');
}

// Formatter function for currency
function currencyFormatter(value) {
  // Format as US currency
  if (!value) {
    return '';  // Return an empty string if no value
  }

  return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
  }).format(value);
}

// Footer formatter for original_cost column
function originalCostFooter(data) {
  let totalOriginalCost = 0;
  data.forEach(function (row) {
      totalOriginalCost += parseFloat(row.original_cost) || 0;
  });
  return currencyFormatter(totalOriginalCost);
}

// Footer formatter for current_value column
function currentValueFooter(data) {
  let totalCurrentValue = 0;
  data.forEach(function (row) {
      totalCurrentValue += parseFloat(row.current_value) || 0;
  });
  return currencyFormatter(totalCurrentValue);
}

$(document).ready(function () {
  // Initialize the table with options
        // Function to get query parameters from the URL
        function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // Get the 'pg' parameter from the URL (if present)
    const page = getQueryParam('pg') ? parseInt(getQueryParam('pg')) : 1;


  $('#catalog-table').bootstrapTable({
      detailView: true,  // Enable detail view
      detailFormatter: detailFormatter,  // Reference the global detailFormatter function
      pagination: true,  // Enable pagination
      pageList: [5, 10, 25, 50, 100],  // Define page size options
      pageSize: 5,  // Set the fixed page size
      sidePagination: 'client',  // Ensure pagination works on the client side
      showFooter: true,  // Ensure footer is shown
      footerFormatter: sumFooter,  // Set footer formatter
      pageNumber: page,  // Set to the page number from the query parameter

      // Footer callback
      onPostFooter: function () {
          let data = $('#catalog-table').bootstrapTable('getData');
          let footerValues = sumFooter(data);
          $('#catalog-table').bootstrapTable('updateFooter', footerValues);
      }
  });

  // Handle Add Item form submission
  $('#add-item-form').on('submit', function(event) {
      event.preventDefault();

      // Gather form data
      let newItem = {
          id: $('#id').val(),
          image: $('#image').val(),
          title: $('#title').val(),
          franchise: $('#franchise').val(),
          description: $('#description').val(),
          size: $('#size').val(),
          source: $('#source').val(),
          personalized: $('#personalized').val(),
          serialnumber: $('#serialnumber').val(),
          original_cost: $('#original_cost').val(),
          current_value: $('#current_value').val(),
          is_verified: $('#is_verified').val()
      };

      // Load the existing data from catalog.json and update it
      $.getJSON('data/catalog.json', function(data) {
          data.push(newItem);
          saveToFile(data);
      });
  });

  function saveToFile(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalog.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  }

  // Function to get query parameters from the URL
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

});

// Description formatter
function descFormatter(index, row) {
  var desc = row.description.substr(0, 60);
  return desc;
}

// Image formatter for displaying thumbnails
function imageFormatter(index, row) {
    // Get the current page number from the Bootstrap Table
    const currentPage = $('#catalog-table').bootstrapTable('getOptions').pageNumber;
    
    // Get the current page's sender (autographs or collectibles)
    const sender = window.location.pathname.includes('autographs') ? 'autographs' : 'collectibles';

    if (row.image) {
        // Include both page number and sender in the URL
        var imguri = '<a href="imageview.html?index=' + row.id + '&image=' + row.image + '&pg=' + currentPage + '&sender=' + sender + '">'
                   + '<img height=128 width=128 src="images/thumbs/' + row.image + '_thumb.jpg"></a>';
        return imguri;
    } else {
        return '<img height=128 src="images/100.png">';
    }
}

// Row styling function for alternating background colors
function rowStyle(row, index) {
  var classes = ['bg-blue', 'bg-green', 'bg-orange', 'bg-yellow', 'bg-red'];

  if (index % 2 === 0) {
    return { classes: "bg-ltgray" };
  } else {
    return { classes: "bg-ltblue" };
  }
}
