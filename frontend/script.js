// script.js
(() => {
  const API_URL = "http://localhost:5600";
  console.log("Howdy cowboy! JS loaded and ready.");

  // Utility function to format date
  function formatDate(dateString) {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Utility function to format date
  function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
  }

  // Function to delete an order
  function deleteOrder(orderId) {
    fetch(`${API_URL}/api/orders/${orderId}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to delete order");
        return response.json();
      })
      .then(() => {
        // Reload orders after successful deletion
        loadOrders();
        loadSummary();
      })
      .catch((error) => {
        console.error("Error deleting order:", error);
        alert("Failed to delete order. Please try again.");
      });
  }

  // Handle Order Form Submission
  const orderForm = document.getElementById("orderForm");

  if (orderForm) {
    // Load menu items into the select dropdown
    fetch(`${API_URL}/api/menu`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((menuItems) => {
        if (!Array.isArray(menuItems)) {
          throw new Error("Invalid menu data received");
        }

        const select = document.getElementById("menuItem");
        select.innerHTML = '<option value="">-- Choose an item --</option>';

        menuItems.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.name;
          // Handle cases where price might be a string
          const price =
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price;
          option.textContent = `${item.name} - $${price.toFixed(2)}`;
          select.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("Error loading menu items:", error);
        const select = document.getElementById("menuItem");
        select.innerHTML = '<option value="">Error loading menu items</option>';
        select.disabled = true;
      });

    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = document.getElementById("customerName").value.trim();
      const table = document.getElementById("tableNumber").value.trim();
      const item = document.getElementById("menuItem").value;
      const quantity = document.getElementById("quantity").value;

      if (!name || !table || !item || !quantity) {
        alert("Please fill in all fields");
        return;
      }

      fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: name,
          tableNumber: parseInt(table),
          menuItem: item,
          quantity: parseInt(quantity),
        }),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => Promise.reject(err));
          }
          return response.json();
        })
        .then((data) => {
          const successMsg = document.getElementById("orderSuccess");
          successMsg.style.display = "block";
          successMsg.textContent = "✅ Order received successfully!";

          setTimeout(() => {
            successMsg.style.display = "none";
          }, 3000);

          orderForm.reset();
        })
        .catch((error) => {
          console.error("Error:", error);
          alert(error.error || "Failed to submit order. Please try again.");
        });
    });
  }

  // Dashboard functionality
  function loadOrders() {
    const tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    fetch(`${API_URL}/api/orders`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch orders");
        return res.json();
      })
      .then((orders) => {
        tbody.innerHTML = "";
        if (!orders || orders.length === 0) {
          tbody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align:center;color:#aaa;">
                                No orders found
                            </td>
                        </tr>`;
          return;
        }

        orders.forEach((order) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
                        <td>${order.customer_name}</td>
                        <td>${order.table_number}</td>
                        <td>${order.item_name}</td>
                        <td>${order.quantity}</td>
                        <td>${new Date(order.created_at).toLocaleString()}</td>
                    `;
          tbody.appendChild(tr);
        });
      })
      .catch((error) => {
        console.error("Error loading orders:", error);
        tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center;color:#ff4444;">
                            Error loading orders. Please refresh.
                        </td>
                    </tr>`;
      });
  }

  function loadSummary() {
    const totalOrders = document.getElementById("totalOrders");
    const popularItem = document.getElementById("popularItem");
    if (!totalOrders || !popularItem) return;

    fetch(`${API_URL}/api/orders/summary`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch summary");
        return res.json();
      })
      .then((data) => {
        totalOrders.textContent = data.total_orders;
        popularItem.textContent = data.most_popular_item;
      })
      .catch((error) => {
        console.error("Error loading summary:", error);
        totalOrders.textContent = "Error";
        popularItem.textContent = "Error";
      });
  }

  // Handle Reservations
  const reservationForm = document.getElementById("reservationForm");
  if (reservationForm) {
    reservationForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = {
        customerName: document.getElementById("customerName").value.trim(),
        contactNumber: document.getElementById("contactNumber").value.trim(),
        tableNumber: parseInt(document.getElementById("tableNumber").value),
        numGuests: parseInt(document.getElementById("numGuests").value),
        reservationTime: document.getElementById("reservationTime").value,
        specialRequests: document
          .getElementById("specialRequests")
          .value.trim(),
      };

      // Validate inputs
      if (
        !formData.customerName ||
        !formData.contactNumber ||
        !formData.tableNumber ||
        !formData.numGuests ||
        !formData.reservationTime
      ) {
        alert("Please fill in all required fields");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to create reservation");

        const result = await response.json();
        alert("Reservation created successfully!");
        reservationForm.reset();
        loadReservations();
      } catch (error) {
        console.error("Error creating reservation:", error);
        alert("Failed to create reservation. Please try again.");
      }
    });

    // Load existing reservations when page loads
    loadReservations();
  }

  // Handle Reviews
  const reviewForm = document.getElementById("reviewForm");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const customerName = document.getElementById("customerName").value.trim();
      const tableNumber = document.getElementById("tableNumber").value.trim();
      const rating = document.getElementById("rating").value;
      const comment = document.getElementById("comment").value.trim();

      if (!customerName || !tableNumber || !rating || !comment) {
        alert("Please fill in all required fields");
        return;
      }

      try {
        // First create or get customer
        const customerResponse = await fetch(`${API_URL}/api/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerName,
            tableNumber: parseInt(tableNumber),
          }),
        });

        if (!customerResponse.ok)
          throw new Error("Failed to process customer information");

        const customerData = await customerResponse.json();

        // Then submit the review
        const response = await fetch(`${API_URL}/api/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerData.customerId,
            rating: parseInt(rating),
            comment,
          }),
        });

        if (!response.ok) throw new Error("Failed to submit review");

        const result = await response.json();
        alert("Review submitted successfully!");
        reviewForm.reset();
        loadReviews();
      } catch (error) {
        console.error("Error submitting review:", error);
        alert(error.message || "Failed to submit review. Please try again.");
      }
    });

    // Load existing reviews when page loads
    loadReviews();
  }

  // Load reservations
  async function loadReservations() {
    const tbody = document.querySelector("#reservationsTable tbody");
    if (!tbody) return;

    try {
      const response = await fetch(`${API_URL}/api/reservations`);
      if (!response.ok) throw new Error("Failed to fetch reservations");

      const reservations = await response.json();
      tbody.innerHTML = "";

      if (reservations.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center">No reservations found</td></tr>';
        return;
      }

      reservations.forEach((reservation) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${reservation.customer_name}</td>
          <td>${reservation.table_number}</td>
          <td>${reservation.num_guests}</td>
          <td>${formatDate(reservation.reservation_time)}</td>
          <td>${reservation.contact_number}</td>
          <td>${reservation.special_requests || "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("Error loading reservations:", error);
      tbody.innerHTML =
        '<tr><td colspan="6" class="error">Error loading reservations</td></tr>';
    }
  }

  // Load reviews
  async function loadReviews() {
    const container = document.getElementById("reviewsContainer");
    if (!container) return;

    try {
      const response = await fetch(`${API_URL}/api/reviews`);
      if (!response.ok) throw new Error("Failed to fetch reviews");

      const reviews = await response.json();
      container.innerHTML = "";

      if (reviews.length === 0) {
        container.innerHTML = '<p class="text-center">No reviews yet</p>';
        return;
      }

      reviews.forEach((review) => {
        const reviewCard = document.createElement("div");
        reviewCard.className = "review-card";
        reviewCard.innerHTML = `
          <div class="rating">${"⭐".repeat(review.rating)}</div>
          <div class="comment">${review.comment}</div>
          <div class="customer">- ${review.customer_name}</div>
          <div class="date">${formatDate(review.created_at)}</div>
        `;
        container.appendChild(reviewCard);
      });
    } catch (error) {
      console.error("Error loading reviews:", error);
      container.innerHTML = '<div class="error">Error loading reviews</div>';
    }
  }

  // Initialize dashboard if we're on that page
  window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("ordersTable")) {
      loadOrders();
      loadSummary();
      setInterval(() => {
        loadOrders();
        loadSummary();
      }, 30000);
    }
  });
})();
