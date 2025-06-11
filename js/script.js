 
// Determine folder based on HTML filename
const pageName = window.location.pathname.split("/").pop().split(".")[0];  // gets 'autographs', etc.
const thumbPathPrefix = `images/${pageName}/thumbs/`;
const fullPathPrefix = `images/${pageName}/`;  // for future use if needed
// alert("pageName: " + pageName + ", thumbPathPrefix: " + thumbPathPrefix + ", fullPathPrefix: " + fullPathPrefix);

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

    function isMobileView() {
      return window.innerWidth < 1200;
  }
  
  $('#catalog-table').bootstrapTable('destroy').bootstrapTable({
    detailView: true,
    detailFormatter: detailFormatter,
    cardView: isMobileView(),
    pagination: true,
    pageList: [5, 10, 25, 50, 100],
    pageSize: 5,
    sidePagination: 'client',
    showFooter: !isMobileView(),      // ✅ footer only in table mode
    footerFormatter: sumFooter,       // ✅ required for table view footer
    pageNumber: page,
    onPostBody: function () {
      const data = $('#catalog-table').bootstrapTable('getData');
      const totals = sumFooter(data);
  
      if (isMobileView()) {
        const html = `
          <div style="border-top: 1px solid #ccc; padding-top: 10px;">
            <strong>Total Original Cost:</strong> ${totals.original_cost}<br>
            <strong>Total Current Value:</strong> ${totals.current_value}<br>
            <strong>Total Images:</strong> ${totals.image}
          </div>
        `;
        $('#custom-footer').html(html);  // You need <div id="custom-footer"></div> in HTML
      } else {
        $('#custom-footer').empty();     // Clear if switching back to table view
        $('#catalog-table').bootstrapTable('updateFooter', totals);
      }
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
  var desc = row.description.substr(0, 120);
  return desc;
}

// Image formatter for displaying thumbnails
function imageFormatter(index, row) {
    // Get the current page number from the Bootstrap Table
    const currentPage = $('#catalog-table').bootstrapTable('getOptions').pageNumber;
    
    // Get the current page's sender (autographs or collectibles)
    const sender = window.location.pathname.includes('autographs') ? 'autographs' : 'collectibles';
    const type = getItemType(); // Get the item type from the page name
    const editUrl = '<a href="update-item.html?id=' + row.id + '&itemType=' + type + " class='btn btn-sm btn-primary mt-2'>Edit</a>";
  
    if (row.image) {
        // Include both page number and sender in the URL
        var imguri = '<a href="imageview.html?index=' + row.id + '&image=' + row.image + '&pg=' + currentPage + '&sender=' + sender + '">'
        + '<img height=128 width=128 src="images/thumbs/' + row.image + '_thumb.jpg"></a>' + '<a href="update-item.html?id=' + row.id + '&itemType=' + type + '" class="btn btn-sm btn-primary mt-2">Edit</a>';
        return imguri;
    } else {
      return '<img height=128 src="images/100.png">'+ '<a href="update-item.html?id=' + row.id + '&itemType=' + type + '" class="btn btn-sm btn-primary mt-2">Edit</a>';
    }
}


function imageFooterFormatter(data) {
  let count = 0;

  data.forEach(row => {
    if (row.image) {
      const filename = row.image.split('/').pop().toLowerCase();
      if (filename !== '100.png') {
        count++;
      }
    }
  });

  return `${count} images`;
}

     // Case-insensitive alphanumeric sort with numeric prefix handling
     function alphanumericCaseInsensitiveSort(a, b) {
      const regex = /^(\d+)(.*)/i;
      const matchA = a.match(regex);
      const matchB = b.match(regex);

      if (matchA && matchB) {
          const numA = parseInt(matchA[1], 10);
          const numB = parseInt(matchB[1], 10);
          if (numA !== numB) return numA - numB;
          return matchA[2].toLowerCase().localeCompare(matchB[2].toLowerCase());
      }

      return a.toLowerCase().localeCompare(b.toLowerCase());
  }


function getItemType() {
  const page = window.location.pathname.split('/').pop(); // Get the filename
  return page.split('.').shift(); // Remove the extension and return the base name
}
// Edit column formatter
function editFormatter(value, row) {
  const type = getItemType(); // Get the item type from the page name
  return `<a href="update-item.html?ID=${row.id}&itemType=${type}" class="btn btn-sm btn-primary">Edit</a>`;
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
