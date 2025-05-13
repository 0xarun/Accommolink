document.addEventListener('DOMContentLoaded', function() {
    const createPostBtn = document.getElementById('create-post-btn');
    const newPostContent = document.getElementById('new-post-content');
    const newPostImage = document.getElementById('new-post-image');
    const postsContainer = document.getElementById('posts-container');

    const settingsLink = document.getElementById('settings-link');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = settingsModal.querySelector('.close');
    const editProfileForm = document.getElementById('edit-profile-form');
    const profileDropdownBtn = document.getElementById('profile-dropdown-btn');
    const profileDropdownContent = document.getElementById('profile-dropdown-content');


    createPostBtn.addEventListener('click', createPost);
    postsContainer.addEventListener('click', handlePostAction);


    console.log('profileDropdownBtn:', profileDropdownBtn);
    console.log('profileDropdownContent:', profileDropdownContent);

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
    

    // Close action menus when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.matches('.three-dots')) {
            document.querySelectorAll('.menu-items').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });

    // Open settings modal
    settingsLink.addEventListener('click', function(e) {
        e.preventDefault();
        settingsModal.style.display = 'block';
        profileDropdownContent.classList.remove('show');
    });

    // Close settings modal
    closeBtn.addEventListener('click', function() {
        settingsModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    function createPost() {
        const formData = new FormData();
        formData.append('content', newPostContent.value);
        if (newPostImage.files[0]) {
            formData.append('image', newPostImage.files[0]);
        }

        fetch('/create_post/', {
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
        } else if (target.classList.contains('btn-show-replies')) {
            event.preventDefault();
            toggleReplies(target.closest('.post'));
        }
    }
    
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
                repliesContainer.appendChild(newReply);
                form.remove();
                updateReplyCount(parentElement);
            } else {
                console.error('Failed to post reply');
            }
        });
    }

    function loadMoreReplies(button) {
        const postId = button.dataset.postId;
        const offset = parseInt(button.dataset.offset) || 0;
        const repliesContainer = button.closest('.replies-container').querySelector('.top-level-replies');

        button.textContent = 'Loading...';
        button.disabled = true;

        fetch(`/load_more_replies/${postId}/?offset=${offset}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {

                    data.replies.forEach(reply => {
                        repliesContainer.appendChild(createReplyElement(reply));
                    });
                    button.dataset.offset = offset + data.replies.length;

                    if (data.has_more) {
                        button.textContent = `Load more replies`;
                        button.disabled = false;
                    } else {
                        button.remove();
                    }
                } else {
                    throw new Error('Failed to load more replies');
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                button.textContent = 'Load more replies';
                button.disabled = false;
            });
    }
    
        
    function toggleThread(button) {
        const replyId = button.dataset.replyId;
        const replyElement = button.closest('.reply');
        let repliesContainer = replyElement.querySelector('.nested-replies');
        
        if (repliesContainer.children.length > 0) {
            repliesContainer.style.display = repliesContainer.style.display === 'none' ? 'block' : 'none';
            button.textContent = repliesContainer.style.display === 'none' ? 
                `Show replies (${button.dataset.replyCount})` : 'Hide replies';
        } else {
            button.disabled = true;
            button.textContent = 'Loading...';
            
            fetch(`/load_child_replies/${replyId}/`)
                .then(response => response.json())
                .then(data => {
                    data.replies.forEach(reply => {
                        repliesContainer.appendChild(createReplyElement(reply));
                    });
                    
                    button.disabled = false;
                    button.textContent = 'Hide replies';
                    repliesContainer.style.display = 'block';
                })
                .catch(error => {
                    console.error('Error:', error);
                    button.disabled = false;
                    button.textContent = `Show replies (${button.dataset.replyCount})`;
                    alert('An error occurred while loading replies. Please try again later.');
                });
        }
    }
    

    function createReplyElement(reply) {
        const replyElement = document.createElement('div');
        replyElement.className = 'reply';
        replyElement.id = `reply-${reply.id}`;
        replyElement.dataset.depth = reply.depth || 0;
        replyElement.innerHTML = `
            <div class="reply-header">
                <img src="${reply.user_profile_picture || '/static/default_profile.png'}" alt="${reply.user_name}" class="reply-profile-pic">
                <span class="reply-user-name">${reply.user_name}</span>
                <span class="reply-date">${reply.created_at}</span>
            </div>
            ${reply.parent ? `<div class="replying-to">Replying to @${reply.parent_user_name}</div>` : ''}
            <div class="reply-content">${reply.content}</div>
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
            <div class="nested-replies" style="display: none;"></div>
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

    function toggleReplies(postElement) {
        const repliesContainer = postElement.querySelector('.replies');
        if (repliesContainer) {
            repliesContainer.style.display = repliesContainer.style.display === 'none' ? 'block' : 'none';
            const showRepliesBtn = postElement.querySelector('.btn-show-replies');
            showRepliesBtn.textContent = repliesContainer.style.display === 'none' ? 'Show Replies' : 'Hide Replies';
        }
    }


    // Handle profile edit form submission
    editProfileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(editProfileForm);

        fetch('/edit_profile/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Profile updated successfully!');
                settingsModal.style.display = 'none';
                // You might want to update the profile picture and name in the navbar here
            } else {
                alert('Failed to update profile. Please try again.');
            }
        });
    });

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