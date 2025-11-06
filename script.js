document.addEventListener('DOMContentLoaded', function() {
    const todoInput = document.getElementById('todoInput');
    const addTodoButton = document.getElementById('addTodo');
    const todoList = document.getElementById('todoList');

    addTodoButton.addEventListener('click', function() {
        const todoText = todoInput.value.trim();
        if (todoText !== '') {
            addTodoItem(todoText);
            todoInput.value = '';
        }
    });

    function addTodoItem(todoText) {
        const listItem = document.createElement('li');
        listItem.textContent = todoText;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function() {
            listItem.remove();
        };

        listItem.appendChild(deleteButton);
        todoList.appendChild(listItem);
    }
});