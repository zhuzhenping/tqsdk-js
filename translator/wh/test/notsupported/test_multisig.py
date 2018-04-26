#!/usr/bin/env python
#coding=utf-8

import unittest
from wh.test.base import TestConvert



class TestConvertIndicator(TestConvert):
    """
    MULTSIG(Sec1,Sec2,N,INTERVAL) 设置一根k线多信号的指令价方式（TICK逐笔回测，可设置回测精度）

    用法：
    MULTSIG(Sec1,Sec2,N,INTERVAL)
    1、当INTERVAL不为0时，INTERVAL为数据时间间隔,每隔INTERVAL秒计算一次信号，开仓信号在出信号后的第Sec1个数据时间间隔时下单不复核,平仓信号在出信号后的第Sec2个数据时间间隔下单不复核，一根K线上最大的信号个数为N。
    （例：INTERVAL为10，豆粕合约开盘第一根K线21：00：09为第一次计算模型，21：00：19为第二次计算模型...）
    2、当INTERVAL为0时，每笔TICK计算一次信号，开仓信号Sec1秒后下单不复核,平仓信号Sec2秒后下单不复核，一根K线上最大的信号个数为N。
    （例：Sec1为0，则为开仓信号出信号立即下单，不复核；如果Sec1为1，则为开仓信号出信号1秒后下单，不复核）
    3、通过调整INTERVAL参数，模型可设置不同数据快照频率进行回测。

    注：
    1、写了这个函数以后，模型会按照指令价方式运行。
    2、Sec1设置的信号为：BK/SK；Sec2设置的信号为：BP/SP/BPK/SPK/CLOSEOUT
    3、含有该函数的模型，满足条件出信号下单后此信号固定，不随之后行情是否满足条件而变化
    4、INTERVAL代表数据时间间隔
      1）支持0、3、5、10四个值，不支持变量。
      2）参数为3、5、10分别代表用每隔3秒、5秒、10秒，计算一次模型
      3）参数为3、5、10 ，回测速度可提升3-10倍，回测精度稍差
      4）参数为0的时候 为每笔TICK计算一次模型
      5）一个模型中只能写入一个INTERVAL值
    5、出信号后如果未到Sec个数据时间间隔K线已经走完，则提前确认信号下单。
    6、该函数不支持加载到页面盒子中使用。
    7、该函数支持一根K线上多个信号，最大的信号个数为N。N取值范围为1-60，超过这个范围，N值按照60计算
    8、CHECKSIG、MULTSIG、MULTSIG_MIN和CHECKSIG_MIN函数不能同时出现在一个模型中。
    9、模型中不含有该函数，信号执行方式默认为K线走完确认信号下单
    10、N支持写为变量。
    11、该函数不支持量能周期

    例：
    C>REF(H,1),BK;//价格大于上一根k线最高价，开多仓
    C<BKPRICE-3*MINPRICE,SP;//亏损3点止损
    MULTSIG(2,0,4,10);//设置信号复核确认方式为开仓信号，出信号后第2个时间间隔下单不复核（例如09:00:09出现信号，09:00:29仍旧满足条件则确认信号并下单）。根据时间间隔计算出现平仓信号立即下单不复核（例如09:00:39出现平仓信号，则立即下单不复核）。一根K线上最大信号个数为4。每隔10秒计算一次信号。
    AUTOFILTER;
    """
    def test_dmi(self):
        case = {
            "id": "FUNC",
            "cname": "FUNC",
            "type": "SUB",
            "src": """
        VALUEWHEN(HIGH>REF(HHV(HIGH,5),1),HIGH);
        VALUEWHEN(DATE<>REF(DATE,1),O);
        VALUEWHEN(DATE<>REF(DATE,1),L>REF(H,1));
        """,
            "params": [
            ],
            "expected": """
            

            """,
        }

        self.assert_convert(case)


if __name__ == '__main__':
    unittest.main()