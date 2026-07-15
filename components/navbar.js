async function loadNavbar() {

    const response = await fetch("components/navbar.html");

    const html = await response.text();

    document.getElementById("navbar").innerHTML = html;

    setActiveNavLink();
    await loadUsers();
}

async function loadUsers() {
    const response = await fetch('http://168.144.84.3:5000/api/users');
    const users = await response.json();
    const select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">Sign In</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.user_id;
      option.textContent = user.username;
      select.appendChild(option);
    });
    // restore saved user
    const savedId = localStorage.getItem('user_id');
    if (savedId) select.value = savedId;
  }

  function switchUser(userId) {
    if (!userId) return;
    localStorage.setItem('user_id', userId);
  }

  function setActiveNavLink() {
    // e.g. "/plotpoint/explore.html" → "explore.html"
    const currentPage = window.location.pathname.split('/').pop();

    document.querySelectorAll('.nav-links li').forEach(li => {
        if (li.getAttribute('data-page') === currentPage) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}


  