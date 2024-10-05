import Coupon from "../models/coupon.model.js";

export async function getCoupon (req, res) {
    try {
        const coupon = await Coupon.findOne({userId: req.user._id, isActive: true});
        res.json(coupon || null);
    } catch (error) {
        res.status(500).json({message: "Internal server erreo", error: error.message});
        console.log("Error in getCoupon controller", error.message);
    }
};

export async function validateCoupon (req, res) {
    try {
        const {code} = req.body;
        const coupon = await Coupon.findOne({code: code, userId: req.user._id, isActive: true});
        if(!coupon) {
            return res.status(404).json({message:"Coupon not found"});
        };
        if(coupon.expirationDate < new Date()){
            coupon.isActive = false;
            await coupon.save();
            return res.status(404).json({message: "Coupon expired"})
        }
        res.json({
            message: "Coupon is valid",
            code: coupon.code,
            discountPercentage: coupon.discountPercentage
        })
    } catch (error) {
        res.status(500).json({message: "Internal server erreo", error: error.message});
        console.log("Error in validateCoupon controller", error.message);
    }
}
