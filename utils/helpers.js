const { ethers } = require('hardhat');

class ContractHelper {
    constructor(contractAddress, provider, signer) {
        this.contractAddress = contractAddress;
        this.provider = provider;
        this.signer = signer;
        this.contract = null;
    }

    async initialize() {
        const contractFactory = await ethers.getContractFactory('TicketMarketplace');
        this.contract = contractFactory.attach(this.contractAddress).connect(this.signer);
    }

    async createEvent(name, description, price, maxSupply, eventDate) {
        const tx = await this.contract.createEvent(
            name,
            description,
            ethers.parseEther(price.toString()),
            maxSupply,
            Math.floor(new Date(eventDate).getTime() / 1000)
        );
        return await tx.wait();
    }

    async purchaseTicket(eventId, tokenURI, value) {
        const tx = await this.contract.purchaseTicket(eventId, tokenURI, {
            value: ethers.parseEther(value.toString())
        });
        return await tx.wait();
    }

    async useTicket(tokenId) {
        const tx = await this.contract.useTicket(tokenId);
        return await tx.wait();
    }

    async getEventInfo(eventId) {
        return await this.contract.getEventInfo(eventId);
    }

    async getUserTickets(userAddress) {
        return await this.contract.getUserTickets(userAddress);
    }
}

module.exports = ContractHelper;