// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";

contract TicketMarketplace is
    ERC721,
    ERC721URIStorage,
    ERC721Burnable,
    ERC721Pausable,
    Ownable,
    ReentrancyGuard
{
    uint256 private _tokenIdCounter;

    // Struct untuk menyimpan informasi event
    struct Event {
        uint256 eventId;
        string name;
        string description;
        uint256 price;
        uint256 maxSupply;
        uint256 currentSupply;
        uint256 eventDate;
        bool isActive;
        address organizer;
    }

    // Struct untuk menyimpan informasi tiket
    struct Ticket {
        uint256 tokenId;
        uint256 eventId;
        address owner;
        bool isUsed;
        uint256 purchaseDate;
        uint256 usageDate;
    }

    // Mappings
    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => bool) public eventExists;
    mapping(address => uint256[]) public userTickets;
    mapping(uint256 => address) public authorizedVerifiers;
    mapping(uint256 => bool) public tokenExists; // Track token existence

    // Counters
    uint256 public eventCounter;
    uint256 public totalRevenue;

    // Fee untuk platform (dalam basis points, 250 = 2.5%)
    uint256 public platformFee = 250;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% maksimal

    // Events
    event EventCreated(
        uint256 indexed eventId,
        string name,
        uint256 price,
        uint256 maxSupply
    );
    event TicketPurchased(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address buyer,
        uint256 price
    );
    event TicketUsed(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address verifier
    );
    event TicketBurned(uint256 indexed tokenId, uint256 indexed eventId);
    event EventUpdated(uint256 indexed eventId, string name, uint256 price);
    event VerifierAdded(uint256 indexed eventId, address verifier);
    event VerifierRemoved(uint256 indexed eventId, address verifier);

    constructor() ERC721("EventTicket", "ETKT") Ownable(msg.sender) {
        _tokenIdCounter = 0;
        eventCounter = 0;
        totalRevenue = 0;
        platformFee = 250;
    }
    // Modifier untuk memastikan hanya organizer event yang bisa mengakses
    modifier onlyEventOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender, "Not event organizer");
        _;
    }

    // Modifier untuk memastikan event ada
    modifier eventMustExist(uint256 eventId) {
        require(eventExists[eventId], "Event does not exist");
        _;
    }

    // Modifier untuk verifier yang diotorisasi
    modifier onlyAuthorizedVerifier(uint256 eventId) {
        require(
            authorizedVerifiers[eventId] == msg.sender ||
                events[eventId].organizer == msg.sender ||
                owner() == msg.sender,
            "Not authorized verifier"
        );
        _;
    }

    /**
     * @dev Membuat event baru
     */
    function createEvent(
        string memory name,
        string memory description,
        uint256 price,
        uint256 maxSupply,
        uint256 eventDate
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Event name cannot be empty");
        require(maxSupply > 0, "Max supply must be greater than 0");
        require(
            eventDate > block.timestamp,
            "Event date must be in the future"
        );

        eventCounter++;
        uint256 eventId = eventCounter;

        events[eventId] = Event({
            eventId: eventId,
            name: name,
            description: description,
            price: price,
            maxSupply: maxSupply,
            currentSupply: 0,
            eventDate: eventDate,
            isActive: true,
            organizer: msg.sender
        });

        eventExists[eventId] = true;

        emit EventCreated(eventId, name, price, maxSupply);
        return eventId;
    }

    /**
     * @dev Membeli tiket untuk event tertentu
     */
    function purchaseTicket(
        uint256 eventId,
        string memory newTokenURI
    ) external payable nonReentrant whenNotPaused eventMustExist(eventId) {
        Event storage eventInfo = events[eventId];

        require(eventInfo.isActive, "Event is not active");
        require(
            eventInfo.currentSupply < eventInfo.maxSupply,
            "Event sold out"
        );
        require(msg.value >= eventInfo.price, "Insufficient payment");
        require(
            block.timestamp < eventInfo.eventDate,
            "Event has already passed"
        );

        // Mint NFT ticket
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, newTokenURI);

        // Mark token as existing
        tokenExists[tokenId] = true;

        // Update event supply
        eventInfo.currentSupply++;

        // Create ticket record
        tickets[tokenId] = Ticket({
            tokenId: tokenId,
            eventId: eventId,
            owner: msg.sender,
            isUsed: false,
            purchaseDate: block.timestamp,
            usageDate: 0
        });

        // Add to user tickets
        userTickets[msg.sender].push(tokenId);

        // Calculate fees
        uint256 platformFeeAmount = (msg.value * platformFee) / 10000;
        uint256 organizerAmount = msg.value - platformFeeAmount;

        // Transfer payment to organizer
        (bool success, ) = payable(eventInfo.organizer).call{
            value: organizerAmount
        }("");
        require(success, "Payment to organizer failed");

        // Keep platform fee in contract
        totalRevenue += platformFeeAmount;

        // Refund excess payment
        if (msg.value > eventInfo.price) {
            uint256 refund = msg.value - eventInfo.price;
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}(
                ""
            );
            require(refundSuccess, "Refund failed");
        }

        emit TicketPurchased(tokenId, eventId, msg.sender, eventInfo.price);
    }

    /**
     * @dev Menggunakan tiket (verifikasi di pintu masuk)
     */
    function useTicket(
        uint256 tokenId
    ) external onlyAuthorizedVerifier(tickets[tokenId].eventId) {
        require(tokenExists[tokenId], "Ticket does not exist");

        Ticket storage ticket = tickets[tokenId];
        require(!ticket.isUsed, "Ticket already used");

        Event storage eventInfo = events[ticket.eventId];
        require(
            block.timestamp >= eventInfo.eventDate - 1 hours &&
                block.timestamp <= eventInfo.eventDate + 6 hours,
            "Event access window closed"
        );

        // Mark ticket as used
        ticket.isUsed = true;
        ticket.usageDate = block.timestamp;

        emit TicketUsed(tokenId, ticket.eventId, msg.sender);

        // Auto-burn ticket after use
        _burnTicket(tokenId);
    }

    /**
     * @dev Internal function untuk membakar tiket
     */
    function _burnTicket(uint256 tokenId) internal {
        require(tokenExists[tokenId], "Ticket does not exist");

        Ticket storage ticket = tickets[tokenId];

        // Remove from user tickets array
        address ticketOwner = ownerOf(tokenId);
        uint256[] storage userTicketList = userTickets[ticketOwner];
        for (uint256 i = 0; i < userTicketList.length; i++) {
            if (userTicketList[i] == tokenId) {
                userTicketList[i] = userTicketList[userTicketList.length - 1];
                userTicketList.pop();
                break;
            }
        }

        // Mark token as non-existent
        tokenExists[tokenId] = false;

        // Burn the NFT
        _burn(tokenId);

        emit TicketBurned(tokenId, ticket.eventId);
    }

    /**
     * @dev Menambahkan verifier untuk event
     */
    function addVerifier(
        uint256 eventId,
        address verifier
    ) external onlyEventOrganizer(eventId) {
        require(verifier != address(0), "Invalid verifier address");
        authorizedVerifiers[eventId] = verifier;
        emit VerifierAdded(eventId, verifier);
    }

    /**
     * @dev Menghapus verifier untuk event
     */
    function removeVerifier(
        uint256 eventId
    ) external onlyEventOrganizer(eventId) {
        address verifier = authorizedVerifiers[eventId];
        delete authorizedVerifiers[eventId];
        emit VerifierRemoved(eventId, verifier);
    }

    /**
     * @dev Update informasi event
     */
    function updateEvent(
        uint256 eventId,
        string memory name,
        uint256 price
    ) external onlyEventOrganizer(eventId) {
        Event storage eventInfo = events[eventId];
        eventInfo.name = name;
        eventInfo.price = price;

        emit EventUpdated(eventId, name, price);
    }

    /**
     * @dev Mengaktifkan/menonaktifkan event
     */
    function toggleEventStatus(
        uint256 eventId
    ) external onlyEventOrganizer(eventId) {
        events[eventId].isActive = !events[eventId].isActive;
    }

    /**
     * @dev Mendapatkan daftar tiket user
     */
    function getUserTickets(
        address user
    ) external view returns (uint256[] memory) {
        return userTickets[user];
    }

    /**
     * @dev Mendapatkan informasi tiket
     */
    function getTicketInfo(
        uint256 tokenId
    ) external view returns (Ticket memory) {
        require(tokenExists[tokenId], "Ticket does not exist");
        return tickets[tokenId];
    }

    /**
     * @dev Mendapatkan informasi event
     */
    function getEventInfo(
        uint256 eventId
    ) external view returns (Event memory) {
        require(eventExists[eventId], "Event does not exist");
        return events[eventId];
    }

    /**
     * @dev Set platform fee (hanya owner)
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_PLATFORM_FEE, "Fee too high");
        platformFee = newFee;
    }

    /**
     * @dev Withdraw platform revenue (hanya owner)
     */
    function withdrawRevenue() external onlyOwner {
        uint256 amount = totalRevenue;
        totalRevenue = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Emergency pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // Override functions required for multiple inheritance
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Pausable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}
