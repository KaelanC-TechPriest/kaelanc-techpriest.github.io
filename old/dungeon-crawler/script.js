function room(type, is_end) { // async fucking sucks
    this.type = (type === undefined ? 0 : type);
    this.is_end = (is_end === undefined ? false : is_end)
    this.has_visited = false;
}

function randInt(max) {
    return Math.floor(Math.random() * max);
}

function getBack(current) {
    return rooms.get(current)[0];
}

function getFront(current) {
    return rooms.get(current)[1];
}

function getLeft(current) {
    return rooms.get(current)[2];
}

function getRight(current) {
    return rooms.get(current)[3];
}

var rouletteRooms = [];
var videoRooms = [];
const rooms = new Map();
var curr = new room();
curr.has_visited = true; // the 'home' room must have already been visited

const numRooms = 3;
//               back  front left  right
rooms.set(curr, [null, null, null, null]);

for (let i = 0; i < numRooms; i++) {

    let keys = [...rooms.keys()];
    let root;
    var rootRoomIndex = randInt(keys.length);
    while (rooms.get(keys[rootRoomIndex]).every(item => item !== null)) {
        rootRoomIndex = (rootRoomIndex + 1) % keys.length;
    }
    root = keys[rootRoomIndex];

    // this value mod the length of either room will give an equally random index
    let newRoom = new room();
    if (i === numRooms - 1) {
        newRoom.is_end = true;
    }

    newRoom.type = randInt(3);

    rooms.set(newRoom, [root, null, null, null])
    let newRoomIndex = randInt(3) + 1; // do not modify the backwards room (doesn't work)
    while (rooms.get(root)[newRoomIndex] !== null) {
        newRoomIndex = (newRoomIndex + 1) % 4;
    }

    rooms.get(root)[newRoomIndex] = newRoom;
}

const terminalElement = document.querySelector('.terminal');
const inputTerminal = document.querySelector('.terminal-input-command');
const RETURN_VALUE = (inputValue, outputValue) => {
    let outputElement = document.createElement('p');
    outputElement.classList.add('terminal-row');
    outputElement.classList.add('terminal-log');
    outputElement.innerHTML = outputValue;

    let lastInputElement = document.createElement('p');
    lastInputElement.classList.add('terminal-row');
    lastInputElement.innerHTML = `<span class="terminal-user">> </span><span class="terminal-log">${inputValue}</span>`;

    terminalElement.insertBefore(outputElement, inputTerminal.parentNode);
    terminalElement.insertBefore(lastInputElement, outputElement);
};

const inputTerminalHandler = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        let input = e.target.value.toLowerCase(),
            output = "", image = '';
        let argv = input.split(' ');
        console.log(curr, argv);
        switch (argv[0]) {
            case "front":
                if (!getFront(curr)) { output = "You can't go forward. "; }
                else if (curr.is_end) { output = "The game ends after you complete the final room. "; }
                else if (!curr.has_visited) { output = "You must finish the room to continue. "; }
                else {
                    curr = getFront(curr);
                    if (curr.has_visited) { image = "You stand in an empty room"; }
                    else { image = curr.url; }
                }
                break;
            case "back":
                if (!getBack(curr)) { output = "Cant go back. "; }
                else if (curr.is_end) { output = "The game ends after you complete the final room. "; }
                else if (!curr.has_visited) { output = "You must finish the room to continue. "; }
                else {
                    curr = getBack(curr);
                    if (curr.has_visited) { image = "You stand in an empty room"; }
                    else { image = curr.url; }
                }
                break;
            case "left":
                if (!getLeft(curr)) { output = "You can't go left. "; }
                else if (curr.is_end) { output = "The game ends after you complete the final room. "; }
                else if (!curr.has_visited) { output = "You must finish the room to continue. "; }
                else {
                    curr = getLeft(curr);
                    if (curr.has_visited) { image = "You stand in an empty room"; }
                    else { image = curr.url; }
                }
                break;
            case "right":
                if (!getRight(curr)) { output = "You can't go right. "; }
                else if (curr.is_end) { output = "The game ends after you complete the final room. "; }
                else if (!curr.has_visited) { output = "You must finish the room to continue. "; }
                else {
                    curr = getRight(curr);
                    if (curr.has_visited) { image = "You stand in an empty room"; }
                    else { image = curr.url; }
                }
                break;
            case "look":
                if (!curr.has_visited) { output = "You must complete the room before moving on. "; }
                break;
            default:
                output = `'${input}' is not recognized as a command.`;
                break;
        }
        if (curr.has_visited && ['front', 'back', 'left', 'right', 'look', 'finish'].includes(argv[0])) {
            output += "You can go: ";
            let directions = ["back", "front", "left", "right"];
            for (var i = 0; i < 4; i++) {
                if (rooms.get(curr)[i]) {
                    output += directions[i] + ", ";
                }
            }
        }

        RETURN_VALUE(input, output, image);
        inputTerminal.value = '';
    }
};
inputTerminal.addEventListener('keypress', inputTerminalHandler);
