import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {ADDRESS_TYPES} from "../constants.js";
import {Address} from "../models/addresses.models.js";


const createAddress = asyncHandler(async(req,res)=>{
    const user = req.user;

    if(!user){
        throw new ApiError(401,"Unauthorized");
    }

    const {type,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault} = req.body;

    if(type && !Object.values(ADDRESS_TYPES).includes(type)){
        throw new ApiError(400,"Invalid address type");
    }

    const address = new Address({
        user: user?._id,
        type,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault
    });

    const savedAddress = await Address.create(address);

    if(isDefault){
        await Address.updateMany(
            {_id: {$ne: savedAddress._id}, user: user._id},
            {$set: {isDefault: false}}
        );
    }

    return res.
    status(201).
    json(new ApiResponse(201, savedAddress,"Address created successfully"));

});

const getAddresses = asyncHandler(async(req,res)=>{

    const{userId} = req.params;

    if(!userId){
        throw new ApiError(400,"User ID is required");
    }

    const addresses = await Address.find({user: userId});

    return res.
    status(200).
    json(new ApiResponse(200, addresses,"Addresses fetched successfully"));

});

const getAddressById = asyncHandler(async(req,res)=>{
    const user = req.user;
    const {addressId} = req.params;

    if(!user){
        throw new ApiError(401,"Unauthorized");
    }

    const address = await Address.findOne({_id: addressId, user: user._id});
    if(!address){
        throw new ApiError(404,"Address not found");
    }

    return res.
    status(200).
    json(new ApiResponse(200, address,"Address fetched successfully"));
});

const updateAddress = asyncHandler(async(req,res)=>{
    const user = req.user;
    const {addressId} = req.params;

    if(!user){
        throw new ApiError(401,"Unauthorized");
    }

    const {
        type,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        country,
        postalCode,
        isDefault
    } = req.body;

    const updatedAddress = await Address.findOneAndUpdate(
        { _id: addressId, user: user._id },
        { $set: { type, fullName, phone, addressLine1, addressLine2, city, state, country, postalCode, isDefault } },
        { new: true }
    );

    if(!updatedAddress){
        throw new ApiError(404,"Address not found");
    }

    if(isDefault){
        await Address.updateMany(
            {_id: {$ne: updatedAddress._id}, user: user._id},
            {$set: {isDefault: false}}
        );
    }


    return res.
    status(200).
    json(new ApiResponse(200, updatedAddress,"Address updated successfully"));
});

const deleteAddress = asyncHandler(async(req,res)=>{
    const user = req.user;
    const {addressId} = req.params;
    if(!user){
        throw new ApiError(401,"Unauthorized");
    }

    const address = await Address.findOne({_id: addressId, user: user._id});

    if(!address){
        throw new ApiError(404,"Address not found");
    }

    const wasDefault = address.isDefault;

    await Address.deleteOne(address._id);

    if(wasDefault){
        const anotherAddress = await Address.findOne({user: user._id});
        if(anotherAddress){
            anotherAddress.isDefault = true;
            await anotherAddress.save();
        }
    }

    return res.
    status(200).
    json(new ApiResponse(200, null,"Address deleted successfully"));
})

export {
    createAddress,
    getAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
};