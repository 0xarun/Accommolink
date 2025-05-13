document.addEventListener('DOMContentLoaded', function() {
    const createPostBtn = document.getElementById('create-post-btn');
    const newPostContent = document.getElementById('new-post-content');
    const newPostImage = document.getElementById('new-post-image');
    const postsContainer = document.getElementById('posts-container');
    const profileDropdownBtn = document.getElementById('profile-dropdown-btn');
    const profileDropdownContent = document.getElementById('profile-dropdown-content');

    if (profileDropdownBtn && profileDropdownContent) {
        // Toggle dropdown
        profileDropdownBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            profileDropdownContent.classList.toggle('show');
            this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!profileDropdownBtn.contains(event.target) && !profileDropdownContent.contains(event.target)) {
                profileDropdownContent.classList.remove('show');
                profileDropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // For mobile: close dropdown when clicking on a link
        profileDropdownContent.addEventListener('click', function(event) {
            if (event.target.tagName === 'A') {
                profileDropdownContent.classList.remove('show');
                profileDropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });
    } else {
        console.error('Could not find profile dropdown elements');
    }
    

    createPostBtn.addEventListener('click', createPost);
    postsContainer.addEventListener('click', handlePostAction);

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    function createPost() {
        const formData = new FormData();
        formData.append('content', newPostContent.value);
        if (newPostImage.files[0]) {
            formData.append('image', newPostImage.files[0]);
        }

        fetch(window.location.pathname + 'create_post/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                console.error('Failed to create post');
            }
        });
    }

    function attachEventListeners(container) {
        container.querySelectorAll('.btn-reply').forEach(btn => {
            btn.addEventListener('click', showReplyForm);
        });
    
        container.querySelectorAll('.btn-edit-reply').forEach(btn => {
            btn.addEventListener('click', showEditReplyForm);
        });
    
        container.querySelectorAll('.btn-delete-reply').forEach(btn => {
            btn.addEventListener('click', deleteReply);
        });
    
        container.querySelectorAll('.btn-show-thread').forEach(btn => {
            btn.addEventListener('click', toggleThread);
        });
    
        container.querySelectorAll('.btn-submit-reply').forEach(btn => {
            btn.addEventListener('click', submitReply);
        });
    
        container.querySelectorAll('.btn-submit-edit-reply').forEach(btn => {
            btn.addEventListener('click', submitEditReply);
        });
    
        container.querySelectorAll('.three-dots').forEach(btn => {
            btn.addEventListener('click', toggleActionMenu);
        });
    }

    document.querySelectorAll('.btn-load-replies').forEach(btn => {
        btn.addEventListener('click', function() {
            loadMoreReplies(this);
        });
    });

    function handlePostAction(event) {
        const target = event.target;
    
        if (target.classList.contains('btn-reply')) {
            event.preventDefault();
            const existingForm = target.closest('.post, .reply').querySelector('.reply-form');
            if (existingForm) {
                existingForm.remove();
            } else {
                showReplyForm(target.closest('.post, .reply'), target.dataset.postId, target.dataset.parentId);
            }
        } else if (target.classList.contains('btn-edit')) {
            showEditForm(target.closest('.post'), target.dataset.postId);
        } else if (target.classList.contains('btn-delete')) {
            deletePost(target.dataset.postId);
        } else if (target.classList.contains('btn-edit-reply')) {
            showEditReplyForm(target.closest('.reply'), target.dataset.replyId);
        } else if (target.classList.contains('btn-delete-reply')) {
            deleteReply(target.dataset.replyId);
        } else if (target.classList.contains('btn-submit-reply')) {
            submitReply(target.closest('form'));
        } else if (target.classList.contains('btn-submit-edit')) {
            submitEdit(target.closest('form'));
        } else if (target.classList.contains('btn-submit-edit-reply')) {
            submitEditReply(target.closest('form'));
        } else if (target.classList.contains('three-dots')) {
            event.stopPropagation();
            toggleActionMenu(target.nextElementSibling);
        } else if (target.classList.contains('btn-show-thread')) {
            toggleThread(target);
        } else if (target.classList.contains('btn-load-replies')) {
            loadMoreReplies(target);
        }
    }

    // Include other functions from dashboard.js (showReplyForm, submitReply, showEditForm, submitEdit, etc.)
    function showReplyForm(element, postId, parentId) {
        const existingForm = element.querySelector('.reply-form');
        if (existingForm) {
            existingForm.remove();
            return;
        }
    
        const replyForm = document.createElement('form');
        replyForm.className = 'reply-form';
        replyForm.innerHTML = `
            <textarea name="content" required></textarea>
            <input type="hidden" name="post_id" value="${postId}">
            ${parentId ? `<input type="hidden" name="parent_id" value="${parentId}">` : ''}
            <button type="button" class="btn-submit-reply">Submit Reply</button>
        `;
    
        // Insert the form after the reply button
        const replyButton = element.querySelector('.btn-reply');
        replyButton.insertAdjacentElement('afterend', replyForm);
    }
    
    function submitReply(form) {
        const formData = new FormData(form);
        const postId = formData.get('post_id');
    
        fetch(`/reply_to_post/${postId}/`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const newReply = createReplyElement(data.reply);
                const parentElement = form.closest('.post, .reply');
                let repliesContainer = parentElement.querySelector('.replies');
                if (!repliesContainer) {
                    repliesContainer = document.createElement('div');
                    repliesContainer.className = 'replies';
                    parentElement.appendChild(repliesContainer);
                }
                repliesContainer.insertBefore(newReply, repliesContainer.firstChild);
                loadedReplyIds.add(data.reply.id);
                form.reset();
                updateReplyCount(parentElement);
    
                // Update the "Load more replies" button
                const loadMoreButton = parentElement.querySelector('.btn-load-replies');
                if (loadMoreButton) {
                    const currentOffset = parseInt(loadMoreButton.dataset.offset) || 0;
                    loadMoreButton.dataset.offset = currentOffset + 1;
                }
            } else {
                console.error('Failed to post reply');
            }
        });
    }

    let loadedReplyIds = new Set();

    function loadMoreReplies(button) {
        const postId = button.dataset.postId;
        const offset = parseInt(button.dataset.offset) || 0;
        
        console.log('Load more button:', button);
        console.log('Button parent:', button.parentElement);
        
        // Change this line
        let repliesContainer = button.closest('.replies-container');
        
        if (!repliesContainer) {
            console.error('Replies container not found for post:', postId);
            console.log('Button HTML:', button.outerHTML);
            return;
        }
    
        fetch(`/forum_load_more_replies/${postId}/?offset=${offset}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    
                    // Create a new container for the loaded replies if it doesn't exist
                    let loadedRepliesContainer = repliesContainer.querySelector('.loaded-replies');
                    if (!loadedRepliesContainer) {
                        loadedRepliesContainer = document.createElement('div');
                        loadedRepliesContainer.className = 'loaded-replies';
                        repliesContainer.insertBefore(loadedRepliesContainer, button);
                    }
    
                    data.replies.forEach(reply => {
                        if (!loadedReplyIds.has(reply.id)) {
                            const replyElement = createReplyElement(reply);
                            loadedRepliesContainer.appendChild(replyElement);
                            loadedReplyIds.add(reply.id);
                        }
                    });
    
                    // Update the button's offset and text
                    button.dataset.offset = data.next_offset;
                    if (data.has_more) {
                        button.textContent = `Load more replies`;
                    } else {
                        button.remove();
                    }
    
                    // Reattach event listeners to new elements
                    attachEventListeners(loadedRepliesContainer);
                } else {
                    console.error('Failed to load replies:', data.error);
                }
            })
            .catch(error => {
                console.error('Error loading replies:', error);
            });
    }

    
    
    function toggleThread(button) {
        const replyId = button.getAttribute('data-reply-id');
        const replyCount = button.getAttribute('data-reply-count');
        const replyElement = button.closest('.reply');
        let repliesContainer = replyElement.querySelector('.nested-replies');
        
        if (repliesContainer) {
            repliesContainer.style.display = repliesContainer.style.display === 'none' ? 'block' : 'none';
            button.textContent = repliesContainer.style.display === 'none' ? `Show replies (${replyCount})` : 'Hide replies';
        } else {
            button.disabled = true;
            fetch(`/load_child_replies/${replyId}/`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        repliesContainer = document.createElement('div');
                        repliesContainer.className = 'nested-replies';
                        data.replies.forEach(reply => {
                            const replyElement = createReplyElement(reply);
                            repliesContainer.appendChild(replyElement);
                        });
                        replyElement.appendChild(repliesContainer);
                        button.disabled = false;
                        button.textContent = 'Hide replies';
                        attachEventListeners(repliesContainer);
                    } else {
                        console.error('Failed to load replies');
                        button.disabled = false;
                    }
                })
                .catch(error => {
                    console.error('Error loading replies:', error);
                    button.disabled = false;
                    button.textContent = 'Error loading replies. Try again.';
                });
        }
    }

    function createReplyElement(reply) {
        const replyElement = document.createElement('div');
        replyElement.className = 'reply';
        replyElement.id = `reply-${reply.id}`;
        replyElement.innerHTML = `
            <div class="reply-header">
                <img src="${reply.user_profile_picture || '/static/images/default-avatar.png'}" alt="${reply.user_name}" class="reply-profile-pic">
                <span class="reply-user-name">${reply.user_name}</span>
                <span class="reply-date">${reply.created_at}</span>
            </div>
            <p class="reply-content">${reply.content}</p>
            <div class="reply-actions">
                <button class="btn-reply" data-post-id="${reply.post_id}" data-parent-id="${reply.id}">Reply</button>
                ${reply.can_edit ? `
                    <button class="btn-edit-reply" data-reply-id="${reply.id}">Edit</button>
                    <button class="btn-delete-reply" data-reply-id="${reply.id}">Delete</button>
                ` : ''}
                ${reply.child_count > 0 ? `
                    <button class="btn-show-thread" data-reply-id="${reply.id}" data-reply-count="${reply.child_count}">
                        Show replies (${reply.child_count})
                    </button>
                ` : ''}
            </div>
        `;
        return replyElement;
    }

    function updateReplyCount(element) {
        const showThreadBtn = element.querySelector('.btn-show-thread');
        if (showThreadBtn) {
            const replyCount = element.querySelectorAll('.reply').length;
            showThreadBtn.textContent = `Show thread (${replyCount} ${replyCount === 1 ? 'reply' : 'replies'})`;
            showThreadBtn.dataset.replyCount = replyCount;
        }
    }

    function showEditForm(postElement, postId) {
        const postContent = postElement.querySelector('.post-content');
        const currentContent = postContent.textContent;
        
        const editForm = document.createElement('form');
        editForm.className = 'edit-post-form';
        editForm.innerHTML = `
            <textarea name="content" required>${currentContent}</textarea>
            <input type="hidden" name="post_id" value="${postId}">
            <button type="button" class="btn-submit-edit">Save Changes</button>
        `;
        
        postContent.replaceWith(editForm);
    }
    
    function submitEdit(form) {
        const formData = new FormData(form);
        const postId = formData.get('post_id');
    
        fetch(`/edit_post/${postId}/`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const newContent = formData.get('content');
                const postContent = document.createElement('div');
                postContent.className = 'post-content';
                postContent.textContent = newContent;
                form.replaceWith(postContent);
            } else {
                console.error('Failed to edit post');
            }
        });
    }

    function showEditReplyForm(replyElement, replyId) {
        const replyContent = replyElement.querySelector('p');
        const currentContent = replyContent.textContent;
        
        const editForm = document.createElement('form');
        editForm.className = 'edit-reply-form';
        editForm.innerHTML = `
            <textarea name="content" required>${currentContent}</textarea>
            <input type="hidden" name="reply_id" value="${replyId}">
            <button type="button" class="btn-submit-edit-reply">Save Changes</button>
        `;
        
        replyContent.replaceWith(editForm);
    }
    
    function submitEditReply(form) {
        const formData = new FormData(form);
        const replyId = formData.get('reply_id');
    
        fetch(`/edit_reply/${replyId}/`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const newContent = formData.get('content');
                const replyContent = document.createElement('p');
                replyContent.textContent = newContent;
                form.replaceWith(replyContent);
            } else {
                console.error('Failed to edit reply');
            }
        });
    }

    function deletePost(postId) {
        if (confirm('Are you sure you want to delete this post?')) {
            fetch(`/delete_post/${postId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById(`post-${postId}`).remove();
                } else {
                    console.error('Failed to delete post');
                }
            });
        }
    }

    function deleteReply(replyId) {
        if (confirm('Are you sure you want to delete this reply?')) {
            fetch(`/delete_reply/${replyId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById(`reply-${replyId}`).remove();
                } else {
                    console.error('Failed to delete reply');
                }
            });
        }
    }

    function toggleActionMenu(menu) {
        // Close all other open menus
        document.querySelectorAll('.menu-items').forEach(item => {
            if (item !== menu && item.style.display === 'block') {
                item.style.display = 'none';
            }
        });

        // Toggle the clicked menu
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }


    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});